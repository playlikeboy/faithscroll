/**
 * Pure RevenueCat webhook logic (no Deno/Supabase APIs) so it is unit tested from Jest
 * (src/services/payments/__tests__/revenuecat-webhook.test.ts).
 *
 * Payload: `{ api_version, event: { id, type, event_timestamp_ms, app_user_id, aliases,
 * entitlement_ids, product_id, store, environment, period_type, expiration_at_ms, ... } }`.
 * See https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */

export const PLUS_ENTITLEMENT_ID = 'plus';
export const MAX_BODY_BYTES = 64 * 1024;

export interface RevenueCatEvent {
  id: string;
  type: string;
  event_timestamp_ms: number;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  product_id?: string | null;
  store?: string | null;
  environment?: string | null;
  period_type?: string | null;
  expiration_at_ms?: number | null;
  cancel_reason?: string | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
}

export type WebhookPlan =
  | { kind: 'ignore'; reason: 'test' | 'unhandled_type' | 'other_entitlement' | 'anonymous' }
  | {
      kind: 'apply';
      eventId: string;
      eventType: string;
      eventAt: string;
      userId: string;
      productId: string | null;
      store: string | null;
      environment: 'SANDBOX' | 'PRODUCTION' | null;
      periodType: string | null;
      expiresAt: string | null;
    }
  | { kind: 'transfer'; eventId: string; eventAt: string; from: string[]; to: string | null };

/** Events that change (or confirm) the entitlement's expiry. */
const ENTITLEMENT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'CANCELLATION',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_PAUSED',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supabase user ids are UUIDs; RevenueCat anonymous ids look like `$RCAnonymousID:…`. */
export function isSupabaseUserId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Constant-time string comparison (length is not secret). */
export function timingSafeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** RevenueCat sends the dashboard-configured Authorization header value verbatim. */
export function isAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!header || !secret) return false;
  const value = header.trim();
  const exact = timingSafeEqual(value, secret);
  const bearer = timingSafeEqual(value, `Bearer ${secret}`);
  return exact || bearer;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export type ParseResult = { ok: true; event: RevenueCatEvent } | { ok: false; error: string };

export function parseWebhookBody(raw: string): ParseResult {
  if (raw.length > MAX_BODY_BYTES) return { ok: false, error: 'payload_too_large' };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  const event = (body as { event?: unknown } | null)?.event as Record<string, unknown> | undefined;
  if (!event || typeof event !== 'object') return { ok: false, error: 'missing_event' };
  if (typeof event.id !== 'string' || event.id.length === 0 || event.id.length > 200) {
    return { ok: false, error: 'invalid_event_id' };
  }
  if (typeof event.type !== 'string' || event.type.length === 0) return { ok: false, error: 'invalid_event_type' };
  if (typeof event.event_timestamp_ms !== 'number' || !Number.isFinite(event.event_timestamp_ms)) {
    return { ok: false, error: 'invalid_event_timestamp' };
  }
  for (const key of ['aliases', 'entitlement_ids', 'transferred_from', 'transferred_to'] as const) {
    if (event[key] != null && !isStringArray(event[key])) return { ok: false, error: `invalid_${key}` };
  }
  return { ok: true, event: event as unknown as RevenueCatEvent };
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function optionalString(value: unknown, maxLength = 200): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : null;
}

/** The Supabase uid behind an event: app_user_id first, then the original id, then aliases. */
export function resolveUserId(event: RevenueCatEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return candidates.find(isSupabaseUserId) ?? null;
}

function grantsEntitlement(event: RevenueCatEvent, entitlementId: string): boolean {
  if (event.entitlement_ids?.includes(entitlementId)) return true;
  return event.entitlement_id === entitlementId;
}

function expiryFor(event: RevenueCatEvent): string | null {
  // Refunds (support-initiated cancellations) revoke access immediately.
  if (event.type === 'CANCELLATION' && event.cancel_reason === 'CUSTOMER_SUPPORT') return toIso(event.event_timestamp_ms);
  return typeof event.expiration_at_ms === 'number' && Number.isFinite(event.expiration_at_ms)
    ? toIso(event.expiration_at_ms)
    : null;
}

/** Decide what a webhook event means for `public.subscriptions`. */
export function planEvent(event: RevenueCatEvent, entitlementId: string = PLUS_ENTITLEMENT_ID): WebhookPlan {
  const eventAt = toIso(event.event_timestamp_ms);
  if (event.type === 'TEST') return { kind: 'ignore', reason: 'test' };

  if (event.type === 'TRANSFER') {
    const from = (event.transferred_from ?? []).filter(isSupabaseUserId);
    const to = (event.transferred_to ?? []).find(isSupabaseUserId) ?? null;
    if (from.length === 0 && !to) return { kind: 'ignore', reason: 'anonymous' };
    return { kind: 'transfer', eventId: event.id, eventAt, from, to };
  }

  if (!ENTITLEMENT_EVENTS.has(event.type)) return { kind: 'ignore', reason: 'unhandled_type' };
  if (!grantsEntitlement(event, entitlementId)) return { kind: 'ignore', reason: 'other_entitlement' };

  const userId = resolveUserId(event);
  if (!userId) return { kind: 'ignore', reason: 'anonymous' };

  const environment = event.environment === 'SANDBOX' || event.environment === 'PRODUCTION' ? event.environment : null;
  return {
    kind: 'apply',
    eventId: event.id,
    eventType: event.type,
    eventAt,
    userId,
    productId: optionalString(event.product_id),
    store: optionalString(event.store, 40),
    environment,
    periodType: optionalString(event.period_type, 40),
    expiresAt: expiryFor(event),
  };
}
