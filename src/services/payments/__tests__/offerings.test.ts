import { Platform } from 'react-native';
import Purchases, { INTRO_ELIGIBILITY_STATUS, PACKAGE_TYPE } from 'react-native-purchases';

import { formatTrial, loadPlanOptions, toPlanOptions, trialLabelFor } from '@/services/payments/offerings';
import { setPaymentsConfigured } from '@/services/payments/runtime';
import { makeOffering, makePackage, makeProduct } from '@/services/payments/testing/fixtures';

jest.mock('react-native-purchases', () =>
  jest.requireActual('@/services/payments/testing/purchases-mock').createPurchasesModuleMock(),
);

const mocked = jest.mocked(Purchases);

const monthly = makePackage(PACKAGE_TYPE.MONTHLY, makeProduct());
const yearly = makePackage(
  PACKAGE_TYPE.ANNUAL,
  makeProduct({
    identifier: 'faithscroll_plus_yearly',
    priceString: '$29.99',
    pricePerMonthString: '$2.50',
    subscriptionPeriod: 'P1Y',
    introPrice: { price: 0, priceString: '$0.00', cycles: 1, period: 'P1W', periodUnit: 'DAY', periodNumberOfUnits: 7 },
  }),
);

describe('toPlanOptions', () => {
  test('lists yearly first with a monthly equivalent, then monthly', () => {
    const options = toPlanOptions(makeOffering([monthly, yearly]));

    expect(options.map((o) => o.period)).toEqual(['annual', 'monthly']);
    expect(options[0]).toMatchObject({
      title: 'Yearly',
      priceString: '$29.99',
      periodLabel: 'per year',
      monthlyEquivalent: '$2.50',
      trialLabel: '7-day free trial',
      productId: 'faithscroll_plus_yearly',
    });
    expect(options[1]).toMatchObject({ title: 'Monthly', monthlyEquivalent: null, trialLabel: null });
  });

  test('hides a trial the user is not eligible for', () => {
    const options = toPlanOptions(makeOffering([yearly]), new Set(['faithscroll_plus_yearly']));

    expect(options[0].trialLabel).toBeNull();
  });

  test('falls back to the subscription period for custom packages and ignores others', () => {
    const custom = makePackage(PACKAGE_TYPE.CUSTOM, makeProduct({ identifier: 'y', subscriptionPeriod: 'P1Y' }), 'custom_year');
    const lifetime = makePackage(PACKAGE_TYPE.LIFETIME, makeProduct({ identifier: 'life', subscriptionPeriod: null }));

    const options = toPlanOptions(makeOffering([custom, lifetime]));

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ id: 'custom_year', period: 'annual' });
  });

  test('ignores a duplicate package for the same period', () => {
    const second = makePackage(PACKAGE_TYPE.CUSTOM, makeProduct({ identifier: 'm2' }), 'monthly_2');

    expect(toPlanOptions(makeOffering([monthly, second]))).toHaveLength(1);
  });
});

describe('trial labels', () => {
  test('Android free phase', () => {
    const product = makeProduct({
      defaultOption: { freePhase: { billingPeriod: { unit: 'WEEK', value: 1, iso8601: 'P1W' }, billingCycleCount: 1 } },
    } as never);

    expect(trialLabelFor(product)).toBe('1-week free trial');
  });

  test('paid intro offers are not trials', () => {
    const product = makeProduct({
      introPrice: { price: 0.99, priceString: '$0.99', cycles: 1, period: 'P1M', periodUnit: 'MONTH', periodNumberOfUnits: 1 },
    });

    expect(trialLabelFor(product)).toBeNull();
  });

  test('formatTrial rejects unknown units and empty counts', () => {
    expect(formatTrial(3, 'month')).toBe('3-month free trial');
    expect(formatTrial(0, 'DAY')).toBeNull();
    expect(formatTrial(1, 'UNKNOWN')).toBeNull();
  });
});

describe('loadPlanOptions', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    setPaymentsConfigured(false);
    Object.defineProperty(Platform, 'OS', { value: originalOS });
    jest.clearAllMocks();
  });

  test('returns nothing (and never calls the SDK) when payments are not configured', async () => {
    await expect(loadPlanOptions()).resolves.toEqual([]);
    expect(mocked.getOfferings).not.toHaveBeenCalled();
  });

  test('returns nothing when no current offering is set up', async () => {
    setPaymentsConfigured(true);
    mocked.getOfferings.mockResolvedValue({ all: {}, current: null });

    await expect(loadPlanOptions()).resolves.toEqual([]);
  });

  test('on iOS drops trials for ineligible users', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    setPaymentsConfigured(true);
    mocked.getOfferings.mockResolvedValue({ all: {}, current: makeOffering([yearly, monthly]) });
    mocked.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({
      faithscroll_plus_yearly: { status: INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE, description: '' },
    });

    const options = await loadPlanOptions();

    expect(mocked.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledWith(['faithscroll_plus_yearly']);
    expect(options[0].trialLabel).toBeNull();
  });

  test('on iOS hides trials when eligibility cannot be checked', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    setPaymentsConfigured(true);
    mocked.getOfferings.mockResolvedValue({ all: {}, current: makeOffering([yearly]) });
    mocked.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error('offline'));

    const options = await loadPlanOptions();

    expect(options[0].trialLabel).toBeNull();
  });

  test('on Android trusts the store’s eligible offers', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    setPaymentsConfigured(true);
    mocked.getOfferings.mockResolvedValue({ all: {}, current: makeOffering([yearly]) });

    const options = await loadPlanOptions();

    expect(mocked.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
    expect(options[0].trialLabel).toBe('7-day free trial');
  });
});
