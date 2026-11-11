import { Linking, Platform } from 'react-native';
import Purchases, { PACKAGE_TYPE, PURCHASES_ERROR_CODE } from 'react-native-purchases';

import { useEntitlementStore } from '@/services/payments/entitlement-store';
import { resetPurchasesIdentityForTests } from '@/services/payments/identity';
import { openManageSubscriptions, purchasePlan, refreshCustomerInfo, restorePlan } from '@/services/payments/purchases';
import { setPaymentsConfigured } from '@/services/payments/runtime';
import { makeCustomerInfo, makeEntitlement, makePackage, makeProduct } from '@/services/payments/testing/fixtures';

jest.mock('react-native-purchases', () =>
  jest.requireActual('@/services/payments/testing/purchases-mock').createPurchasesModuleMock(),
);

jest.mock('@/services/supabase/client', () => ({ getSupabase: () => null, isSupabaseConfigured: () => false }));

const sdk = jest.mocked(Purchases);
const pkg = makePackage(PACKAGE_TYPE.MONTHLY, makeProduct());

beforeEach(() => {
  jest.clearAllMocks();
  resetPurchasesIdentityForTests();
  setPaymentsConfigured(true);
});

afterAll(() => setPaymentsConfigured(false));

describe('purchasePlan', () => {
  test('returns purchased and updates the entitlement store', async () => {
    sdk.purchasePackage.mockResolvedValue({
      productIdentifier: 'faithscroll_plus_monthly',
      customerInfo: makeCustomerInfo(makeEntitlement()),
    } as never);

    const outcome = await purchasePlan(pkg);

    expect(outcome).toEqual({ status: 'purchased', productId: 'faithscroll_plus_monthly', isPlus: true });
    expect(useEntitlementStore.getState().snapshot.isPlus).toBe(true);
  });

  test('treats a user cancel as a calm, non-error outcome', async () => {
    sdk.purchasePackage.mockRejectedValue({ code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR, userCancelled: true });

    await expect(purchasePlan(pkg)).resolves.toEqual({ status: 'cancelled' });
  });

  test('returns a friendly error for store failures', async () => {
    sdk.purchasePackage.mockRejectedValue({ code: PURCHASES_ERROR_CODE.NETWORK_ERROR, userCancelled: false });

    const outcome = await purchasePlan(pkg);

    expect(outcome).toMatchObject({ status: 'failed', error: { kind: 'network' } });
  });

  test('reports pending (Ask to Buy) purchases', async () => {
    sdk.purchasePackage.mockRejectedValue({ code: PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR, userCancelled: false });

    await expect(purchasePlan(pkg)).resolves.toMatchObject({ status: 'failed', error: { kind: 'pending' } });
  });

  test('refuses to purchase when payments are not configured', async () => {
    setPaymentsConfigured(false);

    await expect(purchasePlan(pkg)).resolves.toMatchObject({ status: 'failed', error: { kind: 'unavailable' } });
    expect(sdk.purchasePackage).not.toHaveBeenCalled();
  });
});

describe('restorePlan', () => {
  test('reports whether Plus was restored', async () => {
    sdk.restorePurchases.mockResolvedValue(makeCustomerInfo(makeEntitlement()));

    await expect(restorePlan()).resolves.toEqual({ status: 'restored', isPlus: true });
  });

  test('restoring with no purchases is not an error', async () => {
    sdk.restorePurchases.mockResolvedValue(makeCustomerInfo(null));

    await expect(restorePlan()).resolves.toEqual({ status: 'restored', isPlus: false });
  });

  test('maps restore failures to friendly errors', async () => {
    sdk.restorePurchases.mockRejectedValue({ code: PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR });

    await expect(restorePlan()).resolves.toMatchObject({ status: 'failed', error: { kind: 'store' } });
  });

  test('is unavailable without configuration', async () => {
    setPaymentsConfigured(false);

    await expect(restorePlan()).resolves.toMatchObject({ status: 'failed', error: { kind: 'unavailable' } });
  });
});

describe('refreshCustomerInfo', () => {
  test('publishes the latest info', async () => {
    sdk.getCustomerInfo.mockResolvedValue(makeCustomerInfo(makeEntitlement()));

    await refreshCustomerInfo();

    expect(useEntitlementStore.getState()).toMatchObject({ status: 'ready', snapshot: { isPlus: true } });
  });

  test('never throws when offline', async () => {
    sdk.getCustomerInfo.mockRejectedValue(new Error('offline'));

    await expect(refreshCustomerInfo()).resolves.toBeUndefined();
    expect(useEntitlementStore.getState().status).toBe('error');
  });
});

describe('openManageSubscriptions', () => {
  const originalOS = Platform.OS;
  afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS }));

  test('uses the native sheet on iOS', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });

    await expect(openManageSubscriptions(null)).resolves.toBe(true);
    expect(sdk.showManageSubscriptions).toHaveBeenCalled();
  });

  test('opens the management URL on Android', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    await openManageSubscriptions('https://play.google.com/store/account/subscriptions?sku=x');

    expect(openURL).toHaveBeenCalledWith('https://play.google.com/store/account/subscriptions?sku=x');
  });

  test('returns false when nothing can be opened', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android' });
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));

    await expect(openManageSubscriptions(null)).resolves.toBe(false);
  });
});
