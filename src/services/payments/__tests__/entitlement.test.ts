import { FREE_SNAPSHOT, isExpired, toSubscriptionSnapshot } from '@/services/payments/entitlement';
import { makeCustomerInfo, makeEntitlement } from '@/services/payments/testing/fixtures';

const NOW = Date.parse('2026-11-11T12:00:00.000Z');

describe('toSubscriptionSnapshot', () => {
  test('returns the free tier when the plus entitlement was never granted', () => {
    const snapshot = toSubscriptionSnapshot(makeCustomerInfo(null, 'https://apps.apple.com/account/subscriptions'), NOW);

    expect(snapshot).toEqual({ ...FREE_SNAPSHOT, managementUrl: 'https://apps.apple.com/account/subscriptions' });
  });

  test('marks an active, renewing entitlement as Plus with its expiry', () => {
    const plus = makeEntitlement({ expirationDate: '2027-11-11T00:00:00.000Z', store: 'APP_STORE' });

    const snapshot = toSubscriptionSnapshot(makeCustomerInfo(plus), NOW);

    expect(snapshot).toMatchObject({
      isPlus: true,
      willRenew: true,
      isTrial: false,
      expiresAt: '2027-11-11T00:00:00.000Z',
      productId: 'faithscroll_plus_yearly',
      store: 'APP_STORE',
    });
  });

  test('treats an entitlement whose expiry has passed as inactive even if cached as active', () => {
    const plus = makeEntitlement({ isActive: true, expirationDate: '2026-11-10T00:00:00.000Z' });

    const snapshot = toSubscriptionSnapshot(makeCustomerInfo(plus), NOW);

    expect(snapshot.isPlus).toBe(false);
    expect(snapshot.willRenew).toBe(false);
    expect(snapshot.expiresAt).toBe('2026-11-10T00:00:00.000Z');
  });

  test('keeps the end date of an expired subscription for the settings screen', () => {
    const plus = makeEntitlement({ isActive: false, willRenew: false, expirationDate: '2026-10-01T00:00:00.000Z' });

    const snapshot = toSubscriptionSnapshot(makeCustomerInfo(plus), NOW);

    expect(snapshot).toMatchObject({ isPlus: false, expiresAt: '2026-10-01T00:00:00.000Z' });
  });

  test('flags trials and billing issues', () => {
    const plus = makeEntitlement({ periodType: 'TRIAL', billingIssueDetectedAt: '2026-11-10T00:00:00.000Z' });

    const snapshot = toSubscriptionSnapshot(makeCustomerInfo(plus), NOW);

    expect(snapshot.isTrial).toBe(true);
    expect(snapshot.hasBillingIssue).toBe(true);
  });

  test('non-expiring grants (null expiry) stay active', () => {
    const plus = makeEntitlement({ expirationDate: null, store: 'PROMOTIONAL' });

    expect(toSubscriptionSnapshot(makeCustomerInfo(plus), NOW).isPlus).toBe(true);
  });
});

describe('isExpired', () => {
  test('null never expires and invalid dates are ignored', () => {
    expect(isExpired(null, NOW)).toBe(false);
    expect(isExpired('not a date', NOW)).toBe(false);
  });

  test('compares against now', () => {
    expect(isExpired('2026-11-11T11:59:59.000Z', NOW)).toBe(true);
    expect(isExpired('2026-11-11T12:00:01.000Z', NOW)).toBe(false);
  });
});
