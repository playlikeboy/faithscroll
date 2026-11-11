import {
  DEFAULT_LIMITS,
  isActiveSubscriptionRow,
  requiresPlus,
  reserveQuota,
  resolveLimits,
  resolvePlan,
  type QuotaDb,
} from '../../../../supabase/functions/_shared/quota';

const NOW = new Date('2026-11-11T12:00:00.000Z');

function fakeDb(options: {
  rpc?: Record<string, { data: unknown; error: { message: string; code?: string } | null }>;
  rows?: { data: Record<string, unknown>[] | null; error: { message: string; code?: string } | null };
}): QuotaDb & { rpcCalls: [string, Record<string, unknown>][] } {
  const rpcCalls: [string, Record<string, unknown>][] = [];
  return {
    rpcCalls,
    rpc: (fn, args) => {
      rpcCalls.push([fn, args]);
      return Promise.resolve(options.rpc?.[fn] ?? { data: null, error: { message: 'missing', code: 'PGRST202' } });
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve(options.rows ?? { data: null, error: { message: 'missing', code: '42P01' } }) }),
    }),
  };
}

describe('resolveLimits', () => {
  test('uses defaults without an override and merges valid overrides', () => {
    expect(resolveLimits(null)).toBe(DEFAULT_LIMITS);
    expect(resolveLimits('not json')).toBe(DEFAULT_LIMITS);
    const merged = resolveLimits(JSON.stringify({ free: { recap: 5, study: -1, ask: 'many' } }));
    expect(merged.free).toEqual({ ...DEFAULT_LIMITS.free, recap: 5 });
    expect(merged.plus).toEqual(DEFAULT_LIMITS.plus);
  });
});

describe('isActiveSubscriptionRow', () => {
  test('understands is_active, status and expiry columns', () => {
    expect(isActiveSubscriptionRow({ is_active: true }, NOW)).toBe(true);
    expect(isActiveSubscriptionRow({ is_active: true, expires_at: '2026-11-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isActiveSubscriptionRow({ status: 'trialing', current_period_end: '2026-12-01T00:00:00Z' }, NOW)).toBe(true);
    expect(isActiveSubscriptionRow({ status: 'expired' }, NOW)).toBe(false);
    expect(isActiveSubscriptionRow({ expires_at: '2026-12-01T00:00:00Z' }, NOW)).toBe(true);
    expect(isActiveSubscriptionRow({}, NOW)).toBe(false);
  });
});

describe('resolvePlan', () => {
  test('prefers has_active_plus()', async () => {
    const db = fakeDb({ rpc: { has_active_plus: { data: true, error: null } } });
    await expect(resolvePlan(db, 'u', NOW)).resolves.toBe('plus');
  });

  test('falls back to subscriptions rows, and treats a missing table as free', async () => {
    await expect(resolvePlan(fakeDb({ rows: { data: [{ status: 'active' }], error: null } }), 'u', NOW)).resolves.toBe('plus');
    await expect(resolvePlan(fakeDb({ rows: { data: [{ status: 'cancelled' }], error: null } }), 'u', NOW)).resolves.toBe('free');
    await expect(resolvePlan(fakeDb({}), 'u', NOW)).resolves.toBe('free');
  });
});

describe('reserveQuota', () => {
  const base = { userId: 'u', amount: 1, limits: DEFAULT_LIMITS };

  test('requires Plus for advanced study without touching usage', async () => {
    const db = fakeDb({});
    expect(requiresPlus('study', 'advanced')).toBe(true);
    await expect(reserveQuota(db, { ...base, kind: 'study', plan: 'free', mode: 'advanced' })).resolves.toEqual({
      ok: false,
      code: 'plus_required',
    });
    expect(db.rpcCalls).toHaveLength(0);
  });

  test('passes the plan limit to ai_consume_quota and maps its answer', async () => {
    const allowed = fakeDb({ rpc: { ai_consume_quota: { data: true, error: null } } });
    await expect(reserveQuota(allowed, { ...base, kind: 'recap', plan: 'free' })).resolves.toEqual({ ok: true });
    expect(allowed.rpcCalls[0]).toEqual(['ai_consume_quota', { p_user_id: 'u', p_kind: 'recap', p_amount: 1, p_limit: DEFAULT_LIMITS.free.recap }]);

    const denied = fakeDb({ rpc: { ai_consume_quota: { data: false, error: null } } });
    await expect(reserveQuota(denied, { ...base, kind: 'ask', plan: 'plus' })).resolves.toEqual({ ok: false, code: 'quota_exceeded' });

    const broken = fakeDb({ rpc: { ai_consume_quota: { data: null, error: { message: 'x' } } } });
    await expect(reserveQuota(broken, { ...base, kind: 'ask', plan: 'plus' })).resolves.toEqual({ ok: false, code: 'server' });
  });
});
