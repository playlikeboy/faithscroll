import { act, renderHook } from '@testing-library/react-native';

import { useEntitlements, useSubscriptionStatus } from '@/features/subscriptions/use-entitlements';
import { publishCustomerInfo, setEntitlementStatus, useEntitlementStore } from '@/services/payments/entitlement-store';
import { FREE_SNAPSHOT } from '@/services/payments/entitlement';
import { makeCustomerInfo, makeEntitlement } from '@/services/payments/testing/fixtures';

afterEach(() => {
  jest.useRealTimers();
  useEntitlementStore.setState({ status: 'unavailable', snapshot: FREE_SNAPSHOT });
});

describe('useEntitlements', () => {
  test('defaults to the free tier and is not loading when payments are unavailable', async () => {
    const { result } = await renderHook(() => useEntitlements());

    expect(result.current).toEqual({ isPlus: false, isLoading: false, expiresAt: null });
  });

  test('reports loading until RevenueCat answers, then Plus with its expiry', async () => {
    const { result } = await renderHook(() => useEntitlements());

    await act(async () => setEntitlementStatus('loading'));
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      publishCustomerInfo(makeCustomerInfo(makeEntitlement({ expirationDate: '2099-01-01T00:00:00.000Z' })));
    });
    expect(result.current).toEqual({ isPlus: true, isLoading: false, expiresAt: '2099-01-01T00:00:00.000Z' });
  });

  test('drops to free when the subscription expires while the app is open', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-11-11T12:00:00.000Z') });
    const { result } = await renderHook(() => useEntitlements());

    await act(async () => {
      publishCustomerInfo(makeCustomerInfo(makeEntitlement({ expirationDate: '2026-11-11T12:00:30.000Z' })));
    });
    expect(result.current.isPlus).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(31_000);
    });
    expect(result.current.isPlus).toBe(false);
  });
});

describe('useSubscriptionStatus', () => {
  test('exposes availability and details', async () => {
    await act(async () => {
      publishCustomerInfo(makeCustomerInfo(makeEntitlement({ willRenew: false }), 'https://example.test/manage'));
    });

    const { result } = await renderHook(() => useSubscriptionStatus());

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.snapshot).toMatchObject({ isPlus: true, willRenew: false, managementUrl: 'https://example.test/manage' });
  });

  test('is unavailable when payments are not configured', async () => {
    const { result } = await renderHook(() => useSubscriptionStatus());

    expect(result.current.isAvailable).toBe(false);
  });
});
