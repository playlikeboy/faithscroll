import {
  MONTHLY_LIMITS,
  billingDisclosure,
  ctaLabel,
  describeSubscription,
  normalizePaywallSource,
  storeName,
} from '@/features/subscriptions/plan-content';
import { FREE_SNAPSHOT } from '@/services/payments/entitlement';
import type { PlanOption } from '@/services/payments/offerings';

const yearly = {
  id: '$rc_annual',
  productId: 'faithscroll_plus_yearly',
  period: 'annual',
  title: 'Yearly',
  priceString: '$29.99',
  periodLabel: 'per year',
  monthlyEquivalent: '$2.50',
  trialLabel: null,
} as unknown as PlanOption;

describe('ctaLabel', () => {
  test('names the price when there is no trial', () => {
    expect(ctaLabel(yearly)).toBe('Subscribe for $29.99 per year');
  });

  test('offers the trial only when the store has one', () => {
    expect(ctaLabel({ ...yearly, trialLabel: '7-day free trial' })).toBe('Start 7-day free trial');
  });
});

describe('billingDisclosure', () => {
  test('explains auto-renewal and cancellation', () => {
    const text = billingDisclosure(yearly, 'App Store');

    expect(text).toMatch(/^\$29\.99 per year\./);
    expect(text).toMatch(/renews automatically/);
    expect(text).toMatch(/24 hours/);
    expect(text).toMatch(/App Store account/);
  });

  test('states the price after the trial', () => {
    expect(billingDisclosure({ ...yearly, trialLabel: '7-day free trial' }, 'Google Play')).toMatch(
      /^7-day free trial, then \$29\.99 per year\..*Google Play/,
    );
  });
});

describe('describeSubscription', () => {
  test('free users', () => {
    expect(describeSubscription(FREE_SNAPSHOT)).toEqual({
      planLabel: 'Free',
      detail: 'You’re using Faithscroll’s free features.',
      warning: null,
    });
  });

  test('renewing Plus shows the renewal date and store', () => {
    const summary = describeSubscription({
      ...FREE_SNAPSHOT,
      isPlus: true,
      willRenew: true,
      store: 'APP_STORE',
      expiresAt: '2027-03-01T12:00:00.000Z',
    });

    expect(summary.planLabel).toBe('Faithscroll Plus');
    expect(summary.detail).toMatch(/^Renews on .*2027.* through App Store\.$/);
  });

  test('cancelled Plus reassures that nothing is deleted', () => {
    const summary = describeSubscription({
      ...FREE_SNAPSHOT,
      isPlus: true,
      willRenew: false,
      expiresAt: '2027-03-01T12:00:00.000Z',
    });

    expect(summary.detail).toMatch(/^Ends on .*nothing is deleted/);
  });

  test('trials, non-expiring grants and billing issues', () => {
    expect(describeSubscription({ ...FREE_SNAPSHOT, isPlus: true, isTrial: true }).planLabel).toMatch(/free trial/);
    expect(describeSubscription({ ...FREE_SNAPSHOT, isPlus: true }).detail).toBe('Active.');
    expect(describeSubscription({ ...FREE_SNAPSHOT, isPlus: true, hasBillingIssue: true, store: 'PLAY_STORE' }).warning).toMatch(
      /Google Play/,
    );
  });

  test('expired Plus shows when it ended', () => {
    expect(describeSubscription({ ...FREE_SNAPSHOT, expiresAt: '2026-01-05T12:00:00.000Z' }).detail).toMatch(
      /^Plus ended on .*2026.*still here\.$/,
    );
  });
});

describe('normalizePaywallSource', () => {
  test('accepts short identifiers (lower-cased)', () => {
    expect(normalizePaywallSource('Deep_Study')).toBe('deep_study');
    expect(normalizePaywallSource(['recap', 'x'])).toBe('recap');
  });

  test('rejects anything that could carry free text', () => {
    expect(normalizePaywallSource('my prayer for mum')).toBe('unknown');
    expect(normalizePaywallSource('a'.repeat(41))).toBe('unknown');
    expect(normalizePaywallSource(undefined)).toBe('unknown');
    expect(normalizePaywallSource(42)).toBe('unknown');
  });
});

test('storeName falls back gracefully', () => {
  expect(storeName('APP_STORE')).toBe('App Store');
  expect(storeName(null)).toBe('your app store');
  expect(storeName('STRIPE')).toBe('your app store');
});

test('limits list free and Plus allowances for every AI feature', () => {
  expect(MONTHLY_LIMITS.map((row) => row.feature)).toEqual([
    'Sermon transcription',
    'Sermon recaps',
    'Deep Study',
    'Questions to the study assistant',
  ]);
});
