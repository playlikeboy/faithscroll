/**
 * Unit tests for the RevenueCat webhook's pure logic (the Deno entrypoint is a thin wrapper).
 */
import {
  isAuthorized,
  isSupabaseUserId,
  parseWebhookBody,
  planEvent,
  resolveUserId,
  timingSafeEqual,
  type RevenueCatEvent,
} from '../../../../supabase/functions/revenuecat-webhook/logic';

const UID = '6f1c2a40-8d1e-4c6b-9a55-3c2f1e0d9b7a';
const OTHER_UID = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f';
const T = Date.parse('2026-11-11T10:00:00.000Z');

function event(overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent {
  return {
    id: 'evt_1',
    type: 'INITIAL_PURCHASE',
    event_timestamp_ms: T,
    app_user_id: UID,
    original_app_user_id: UID,
    aliases: [UID],
    entitlement_ids: ['plus'],
    product_id: 'faithscroll_plus_yearly',
    store: 'APP_STORE',
    environment: 'PRODUCTION',
    period_type: 'NORMAL',
    expiration_at_ms: Date.parse('2027-11-11T10:00:00.000Z'),
    ...overrides,
  };
}

describe('authorization', () => {
  test('accepts the exact secret or a Bearer form', () => {
    expect(isAuthorized('s3cret-value', 's3cret-value')).toBe(true);
    expect(isAuthorized('Bearer s3cret-value', 's3cret-value')).toBe(true);
    expect(isAuthorized('  s3cret-value  ', 's3cret-value')).toBe(true);
  });

  test('rejects missing or wrong secrets', () => {
    expect(isAuthorized(null, 's3cret-value')).toBe(false);
    expect(isAuthorized('s3cret-valuX', 's3cret-value')).toBe(false);
    expect(isAuthorized('s3cret', 's3cret-value')).toBe(false);
    expect(isAuthorized('anything', undefined)).toBe(false);
    expect(isAuthorized('', '')).toBe(false);
  });

  test('timingSafeEqual compares full strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('parseWebhookBody', () => {
  test('parses a valid payload', () => {
    const result = parseWebhookBody(JSON.stringify({ api_version: '1.0', event: event() }));

    expect(result).toEqual({ ok: true, event: expect.objectContaining({ id: 'evt_1', type: 'INITIAL_PURCHASE' }) });
  });

  test.each([
    ['not json', 'invalid_json'],
    [JSON.stringify({}), 'missing_event'],
    [JSON.stringify({ event: { ...event(), id: '' } }), 'invalid_event_id'],
    [JSON.stringify({ event: { ...event(), type: 5 } }), 'invalid_event_type'],
    [JSON.stringify({ event: { ...event(), event_timestamp_ms: 'yesterday' } }), 'invalid_event_timestamp'],
    [JSON.stringify({ event: { ...event(), aliases: [1, 2] } }), 'invalid_aliases'],
    ['x'.repeat(70_000), 'payload_too_large'],
  ])('rejects %#', (raw, error) => {
    expect(parseWebhookBody(raw)).toEqual({ ok: false, error });
  });
});

describe('user resolution', () => {
  test('only Supabase uuids count; anonymous RevenueCat ids are ignored', () => {
    expect(isSupabaseUserId(UID)).toBe(true);
    expect(isSupabaseUserId('$RCAnonymousID:8a7b6c5d4e3f')).toBe(false);
    expect(resolveUserId(event({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: null, aliases: [OTHER_UID] }))).toBe(
      OTHER_UID,
    );
  });
});

describe('planEvent', () => {
  test('a purchase upserts the plus row with its expiry', () => {
    expect(planEvent(event())).toEqual({
      kind: 'apply',
      eventId: 'evt_1',
      eventType: 'INITIAL_PURCHASE',
      eventAt: '2026-11-11T10:00:00.000Z',
      userId: UID,
      productId: 'faithscroll_plus_yearly',
      store: 'APP_STORE',
      environment: 'PRODUCTION',
      periodType: 'NORMAL',
      expiresAt: '2027-11-11T10:00:00.000Z',
    });
  });

  test('expiration and ordinary cancellations keep the store expiry', () => {
    const expiry = Date.parse('2026-12-01T00:00:00.000Z');
    expect(planEvent(event({ type: 'EXPIRATION', expiration_at_ms: expiry }))).toMatchObject({
      kind: 'apply',
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
    expect(planEvent(event({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE', expiration_at_ms: expiry }))).toMatchObject({
      expiresAt: '2026-12-01T00:00:00.000Z',
    });
  });

  test('refunds revoke access at the event time', () => {
    expect(planEvent(event({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' }))).toMatchObject({
      expiresAt: '2026-11-11T10:00:00.000Z',
    });
  });

  test('non-expiring purchases store a null expiry', () => {
    expect(planEvent(event({ type: 'NON_RENEWING_PURCHASE', expiration_at_ms: null }))).toMatchObject({ expiresAt: null });
  });

  test('supports the deprecated single entitlement_id field', () => {
    expect(planEvent(event({ entitlement_ids: null, entitlement_id: 'plus' })).kind).toBe('apply');
  });

  test('unknown environments are stored as null and long strings are truncated', () => {
    const plan = planEvent(event({ environment: 'STAGING', product_id: 'p'.repeat(500) }));
    expect(plan).toMatchObject({ environment: null });
    expect(plan.kind === 'apply' && plan.productId?.length).toBe(200);
  });

  test.each([
    [{ type: 'TEST' }, 'test'],
    [{ type: 'VIRTUAL_CURRENCY_TRANSACTION' }, 'unhandled_type'],
    [{ entitlement_ids: ['other'] }, 'other_entitlement'],
    [{ entitlement_ids: null, entitlement_id: null }, 'other_entitlement'],
    [{ app_user_id: '$RCAnonymousID:1', original_app_user_id: '$RCAnonymousID:1', aliases: [] }, 'anonymous'],
  ])('ignores %o (%s)', (overrides, reason) => {
    expect(planEvent(event(overrides as Partial<RevenueCatEvent>))).toEqual({ kind: 'ignore', reason });
  });

  test('transfers move the entitlement between Supabase users', () => {
    const plan = planEvent(
      event({ type: 'TRANSFER', transferred_from: [OTHER_UID, '$RCAnonymousID:1'], transferred_to: ['$RCAnonymousID:2', UID] }),
    );

    expect(plan).toEqual({ kind: 'transfer', eventId: 'evt_1', eventAt: '2026-11-11T10:00:00.000Z', from: [OTHER_UID], to: UID });
  });

  test('transfers to an anonymous user still remove the old owner', () => {
    expect(planEvent(event({ type: 'TRANSFER', transferred_from: [OTHER_UID], transferred_to: ['$RCAnonymousID:2'] }))).toMatchObject({
      kind: 'transfer',
      from: [OTHER_UID],
      to: null,
    });
  });

  test('transfers between anonymous users are ignored', () => {
    expect(planEvent(event({ type: 'TRANSFER', transferred_from: ['$RCAnonymousID:1'], transferred_to: ['$RCAnonymousID:2'] }))).toEqual({
      kind: 'ignore',
      reason: 'anonymous',
    });
  });
});
