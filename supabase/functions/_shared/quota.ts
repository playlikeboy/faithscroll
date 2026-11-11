/**
 * Entitlement + monthly usage limits for AI features (PRD §7 "validate subscription entitlement
 * + usage limits", §14). Pure module: the Supabase client is injected, so it is unit tested from Jest.
 *
 * Plan detection prefers `public.has_active_plus(p_user_id uuid) returns boolean` if the
 * monetization migration provides it, then falls back to reading `public.subscriptions` rows
 * tolerantly. A missing table or function means "free".
 */
import type { JobType } from './ai-core.ts';

export type Plan = 'free' | 'plus';
export type QuotaKind = JobType;

/** transcribe = seconds of audio per month; the others = requests per month. */
export type Limits = Record<QuotaKind, number>;

export const DEFAULT_LIMITS: Record<Plan, Limits> = {
  free: { transcribe: 60 * 60, recap: 2, study: 10, ask: 30 },
  plus: { transcribe: 20 * 60 * 60, recap: 40, study: 300, ask: 600 },
};

const KINDS: readonly QuotaKind[] = ['transcribe', 'recap', 'study', 'ask'];

/** Merge an optional JSON override (secret AI_LIMITS_JSON) over the defaults; invalid values are ignored. */
export function resolveLimits(overrideJson: string | null | undefined): Record<Plan, Limits> {
  if (!overrideJson) return DEFAULT_LIMITS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(overrideJson);
  } catch {
    return DEFAULT_LIMITS;
  }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LIMITS;
  const merge = (plan: Plan): Limits => {
    const source = (parsed as Record<string, unknown>)[plan];
    const base = DEFAULT_LIMITS[plan];
    if (typeof source !== 'object' || source === null) return base;
    return KINDS.reduce<Limits>((acc, kind) => {
      const value = (source as Record<string, unknown>)[kind];
      return Number.isInteger(value) && (value as number) >= 0 ? { ...acc, [kind]: value as number } : acc;
    }, base);
  };
  return { free: merge('free'), plus: merge('plus') };
}

/** Advanced Deep Study is a Plus feature (PRD §14 "advanced AI study, deeper study"). */
export function requiresPlus(kind: QuotaKind, mode?: string): boolean {
  return kind === 'study' && mode === 'advanced';
}

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'trial', 'in_trial', 'grace_period', 'in_grace_period']);

/** Tolerant check of a `public.subscriptions` row (schema owned by the monetization agent). */
export function isActiveSubscriptionRow(row: Record<string, unknown>, now: Date): boolean {
  const expiresRaw = row.expires_at ?? row.expiration_at ?? row.current_period_end ?? row.expires_date;
  const expires = typeof expiresRaw === 'string' ? Date.parse(expiresRaw) : Number.NaN;
  const notExpired = Number.isNaN(expires) || expires > now.getTime();
  if (typeof row.is_active === 'boolean') return row.is_active && notExpired;
  if (typeof row.active === 'boolean') return row.active && notExpired;
  if (typeof row.status === 'string') return ACTIVE_STATUSES.has(row.status.toLowerCase()) && notExpired;
  return !Number.isNaN(expires) && expires > now.getTime();
}

interface DbError {
  code?: string;
  message: string;
}

interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

/** The slice of the Supabase client this module uses (service-role client in production). */
export interface QuotaDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<DbResult<unknown>>;
  from(table: string): {
    select(columns: string): { eq(column: string, value: string): PromiseLike<DbResult<Record<string, unknown>[]>> };
  };
}

export async function resolvePlan(db: QuotaDb, userId: string, now: Date): Promise<Plan> {
  const viaFunction = await db.rpc('has_active_plus', { p_user_id: userId });
  if (!viaFunction.error && typeof viaFunction.data === 'boolean') return viaFunction.data ? 'plus' : 'free';

  const rows = await db.from('subscriptions').select('*').eq('user_id', userId);
  if (rows.error || !rows.data) return 'free';
  return rows.data.some((row) => isActiveSubscriptionRow(row, now)) ? 'plus' : 'free';
}

export type QuotaDecision = { ok: true } | { ok: false; code: 'quota_exceeded' | 'plus_required' | 'server' };

/** Check entitlement and atomically reserve usage. */
export async function reserveQuota(
  db: QuotaDb,
  params: { userId: string; kind: QuotaKind; amount: number; plan: Plan; limits: Record<Plan, Limits>; mode?: string },
): Promise<QuotaDecision> {
  if (requiresPlus(params.kind, params.mode) && params.plan !== 'plus') return { ok: false, code: 'plus_required' };
  const { data, error } = await db.rpc('ai_consume_quota', {
    p_user_id: params.userId,
    p_kind: params.kind,
    p_amount: params.amount,
    p_limit: params.limits[params.plan][params.kind],
  });
  if (error) return { ok: false, code: 'server' };
  return data === true ? { ok: true } : { ok: false, code: 'quota_exceeded' };
}

export async function releaseQuota(
  db: QuotaDb,
  params: { userId: string; kind: QuotaKind; amount: number; period: string },
): Promise<void> {
  await db.rpc('ai_release_quota', {
    p_user_id: params.userId,
    p_kind: params.kind,
    p_amount: params.amount,
    p_period: params.period,
  });
}
