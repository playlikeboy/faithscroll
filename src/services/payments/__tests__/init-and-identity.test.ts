import Purchases from 'react-native-purchases';

import { useEntitlementStore } from '@/services/payments/entitlement-store';
import { getRevenueCatApiKey, isNativePurchasesAvailable } from '@/services/payments/environment';
import { resetPurchasesIdentityForTests, syncPurchasesUser, watchSupabaseIdentity } from '@/services/payments/identity';
import { initPayments, isPaymentsConfigured, resetPaymentsForTests } from '@/services/payments/init';
import { setPaymentsConfigured } from '@/services/payments/runtime';
import { makeCustomerInfo, makeEntitlement } from '@/services/payments/testing/fixtures';
import { getSupabase } from '@/services/supabase/client';

jest.mock('react-native-purchases', () =>
  jest.requireActual('@/services/payments/testing/purchases-mock').createPurchasesModuleMock(),
);

jest.mock('@/services/payments/environment', () => ({
  ...jest.requireActual('@/services/payments/environment'),
  getRevenueCatApiKey: jest.fn(),
  isNativePurchasesAvailable: jest.fn(),
}));

jest.mock('@/services/supabase/client', () => ({ getSupabase: jest.fn(() => null), isSupabaseConfigured: () => false }));

const sdk = jest.mocked(Purchases);
const mockedKey = jest.mocked(getRevenueCatApiKey);
const mockedNative = jest.mocked(isNativePurchasesAvailable);
const mockedSupabase = jest.mocked(getSupabase);

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  resetPaymentsForTests();
  resetPurchasesIdentityForTests();
  sdk.getCustomerInfo.mockResolvedValue(makeCustomerInfo(makeEntitlement()));
});

describe('initPayments', () => {
  test('is a safe no-op when no RevenueCat key is configured', () => {
    mockedKey.mockReturnValue(null);
    mockedNative.mockReturnValue(true);

    initPayments();

    expect(sdk.configure).not.toHaveBeenCalled();
    expect(isPaymentsConfigured()).toBe(false);
    expect(useEntitlementStore.getState()).toMatchObject({ status: 'unavailable', snapshot: { isPlus: false } });
  });

  test('is a safe no-op when the native module is missing (Expo Go, tests)', () => {
    mockedKey.mockReturnValue('appl_public_key');
    mockedNative.mockReturnValue(false);

    initPayments();

    expect(sdk.configure).not.toHaveBeenCalled();
    expect(isPaymentsConfigured()).toBe(false);
  });

  test('configures RevenueCat once, listens for changes and loads the current entitlement', async () => {
    mockedKey.mockReturnValue('appl_public_key');
    mockedNative.mockReturnValue(true);

    initPayments();
    initPayments();
    await flush();

    expect(sdk.configure).toHaveBeenCalledTimes(1);
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: 'appl_public_key', automaticDeviceIdentifierCollectionEnabled: false });
    expect(sdk.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1);
    expect(isPaymentsConfigured()).toBe(true);
    expect(useEntitlementStore.getState()).toMatchObject({ status: 'ready', snapshot: { isPlus: true } });
  });

  test('marks status as error (free tier) when CustomerInfo cannot load', async () => {
    mockedKey.mockReturnValue('goog_public_key');
    mockedNative.mockReturnValue(true);
    sdk.getCustomerInfo.mockRejectedValue({ code: '10', message: 'offline' });

    initPayments();
    await flush();

    expect(useEntitlementStore.getState()).toMatchObject({ status: 'error', snapshot: { isPlus: false } });
  });

  test('stays unavailable if configure throws', () => {
    mockedKey.mockReturnValue('appl_public_key');
    mockedNative.mockReturnValue(true);
    sdk.configure.mockImplementationOnce(() => {
      throw new Error('bad key');
    });

    initPayments();

    expect(isPaymentsConfigured()).toBe(false);
    expect(useEntitlementStore.getState().status).toBe('unavailable');
  });

  test('the listener publishes entitlement changes to the store', () => {
    mockedKey.mockReturnValue('appl_public_key');
    mockedNative.mockReturnValue(true);
    initPayments();
    const listener = sdk.addCustomerInfoUpdateListener.mock.calls[0][0];

    listener(makeCustomerInfo(null));

    expect(useEntitlementStore.getState().snapshot.isPlus).toBe(false);
  });
});

describe('syncPurchasesUser', () => {
  beforeEach(() => setPaymentsConfigured(true));

  test('does nothing when payments are not configured', async () => {
    setPaymentsConfigured(false);

    await syncPurchasesUser('user-1');

    expect(sdk.logIn).not.toHaveBeenCalled();
  });

  test('logs in with the Supabase user id once, even if called repeatedly', async () => {
    sdk.logIn.mockResolvedValue({ customerInfo: makeCustomerInfo(makeEntitlement()), created: false });

    await Promise.all([syncPurchasesUser('user-1'), syncPurchasesUser('user-1')]);
    await syncPurchasesUser('user-1');

    expect(sdk.logIn).toHaveBeenCalledTimes(1);
    expect(sdk.logIn).toHaveBeenCalledWith('user-1');
    expect(useEntitlementStore.getState().snapshot.isPlus).toBe(true);
  });

  test('logs out when the user signs out (only if identified)', async () => {
    sdk.logIn.mockResolvedValue({ customerInfo: makeCustomerInfo(makeEntitlement()), created: false });
    sdk.isAnonymous.mockResolvedValue(false);
    sdk.logOut.mockResolvedValue(makeCustomerInfo(null));

    await syncPurchasesUser('user-1');
    await syncPurchasesUser(null);

    expect(sdk.logOut).toHaveBeenCalledTimes(1);
    expect(useEntitlementStore.getState().snapshot.isPlus).toBe(false);
  });

  test('does not log out an anonymous user', async () => {
    sdk.isAnonymous.mockResolvedValue(true);

    await syncPurchasesUser(null);

    expect(sdk.logOut).not.toHaveBeenCalled();
  });

  test('retries the same identity after a failure', async () => {
    sdk.logIn.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      customerInfo: makeCustomerInfo(null),
      created: true,
    });

    await syncPurchasesUser('user-1');
    await syncPurchasesUser('user-1');

    expect(sdk.logIn).toHaveBeenCalledTimes(2);
  });
});

describe('watchSupabaseIdentity', () => {
  test('is a no-op without a Supabase client', () => {
    expect(() => watchSupabaseIdentity()()).not.toThrow();
  });

  test('follows auth state changes and unsubscribes', async () => {
    setPaymentsConfigured(true);
    sdk.logIn.mockResolvedValue({ customerInfo: makeCustomerInfo(null), created: false });
    const unsubscribe = jest.fn();
    let callback: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
    mockedSupabase.mockReturnValue({
      auth: {
        onAuthStateChange: (cb: typeof callback) => {
          callback = cb;
          return { data: { subscription: { unsubscribe } } };
        },
      },
    } as never);

    const stop = watchSupabaseIdentity();
    callback?.('SIGNED_IN', { user: { id: 'user-42' } });
    await flush();
    stop();

    expect(sdk.logIn).toHaveBeenCalledWith('user-42');
    expect(unsubscribe).toHaveBeenCalled();
  });
});
