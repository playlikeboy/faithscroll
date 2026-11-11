import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useSession } from '@/features/auth/use-session';
import { usePaywall } from '@/features/subscriptions/use-paywall';
import { track } from '@/services/monitoring/analytics';
import { FREE_SNAPSHOT } from '@/services/payments/entitlement';
import { useEntitlementStore } from '@/services/payments/entitlement-store';
import { syncPurchasesUser } from '@/services/payments/identity';
import { loadPlanOptions, type PlanOption } from '@/services/payments/offerings';
import { purchasePlan } from '@/services/payments/purchases';
import { isSupabaseConfigured } from '@/services/supabase/client';

jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/payments/offerings', () => ({ loadPlanOptions: jest.fn() }));
jest.mock('@/services/payments/purchases', () => ({ purchasePlan: jest.fn(), restorePlan: jest.fn() }));
jest.mock('@/services/payments/identity', () => ({ syncPurchasesUser: jest.fn(async () => undefined) }));
jest.mock('@/services/supabase/client', () => ({ isSupabaseConfigured: jest.fn(() => false), getSupabase: () => null }));
jest.mock('@/features/auth/use-session', () => ({
  useSession: jest.fn(() => ({ session: null, userId: null, isLoading: false })),
}));

const monthly = {
  id: '$rc_monthly',
  productId: 'monthly',
  period: 'monthly',
  title: 'Monthly',
  priceString: '$3.99',
  periodLabel: 'per month',
  monthlyEquivalent: null,
  trialLabel: null,
  pkg: {},
} as unknown as PlanOption;
const yearly = { ...monthly, id: '$rc_annual', productId: 'yearly', title: 'Yearly', period: 'annual' } as PlanOption;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  useEntitlementStore.setState({ status: 'ready', snapshot: FREE_SNAPSHOT });
});

afterAll(() => useEntitlementStore.setState({ status: 'unavailable', snapshot: FREE_SNAPSHOT }));

test('tracks a single paywall_viewed with a sanitized source', async () => {
  jest.mocked(loadPlanOptions).mockResolvedValue([yearly, monthly]);
  const { result, rerender } = await renderHook(() => usePaywall('Deep_Study'), { wrapper });
  await waitFor(() => expect(result.current.plans.kind).toBe('ready'));
  await rerender({});

  expect(jest.mocked(track)).toHaveBeenCalledTimes(1);
  expect(jest.mocked(track)).toHaveBeenCalledWith({ name: 'paywall_viewed', source: 'deep_study' });
});

test('loads plans, preselects the first and lets the user choose another', async () => {
  jest.mocked(loadPlanOptions).mockResolvedValue([yearly, monthly]);
  const { result } = await renderHook(() => usePaywall(undefined), { wrapper });

  await waitFor(() => expect(result.current.plans.kind).toBe('ready'));
  expect(result.current.selected?.id).toBe('$rc_annual');
  expect(result.current.cta).toBe('Subscribe for $3.99 per month');

  await act(async () => result.current.select('$rc_monthly'));
  expect(result.current.selected?.id).toBe('$rc_monthly');
});

test('buys the selected plan', async () => {
  jest.mocked(loadPlanOptions).mockResolvedValue([monthly]);
  jest.mocked(purchasePlan).mockResolvedValue({ status: 'purchased', productId: 'monthly', isPlus: true });
  const { result } = await renderHook(() => usePaywall('settings'), { wrapper });
  await waitFor(() => expect(result.current.plans.kind).toBe('ready'));

  let unlocked = false;
  await act(async () => {
    unlocked = await result.current.buySelected();
  });

  expect(unlocked).toBe(true);
  expect(jest.mocked(purchasePlan)).toHaveBeenCalledWith(monthly.pkg);
});

test('reports an empty offering', async () => {
  jest.mocked(loadPlanOptions).mockResolvedValue([]);
  const { result } = await renderHook(() => usePaywall(undefined), { wrapper });

  await waitFor(() => expect(result.current.plans.kind).toBe('empty'));
});

test('reports a load error after one retry', async () => {
  jest.mocked(loadPlanOptions).mockRejectedValue(new Error('offline'));
  const { result } = await renderHook(() => usePaywall(undefined), { wrapper });

  // usePlanOptions retries once (1 s backoff) before reporting an error.
  await waitFor(() => expect(result.current.plans.kind).toBe('error'), { timeout: 4000 });
}, 10_000);

test('is unavailable (and never loads plans) when payments are not configured', async () => {
  useEntitlementStore.setState({ status: 'unavailable', snapshot: FREE_SNAPSHOT });
  const { result } = await renderHook(() => usePaywall(undefined), { wrapper });

  expect(result.current.plans.kind).toBe('unavailable');
  expect(jest.mocked(loadPlanOptions)).not.toHaveBeenCalled();
  await expect(result.current.buySelected()).resolves.toBe(false);
});

test('requires an account when cloud features are configured and the user is signed out', async () => {
  jest.mocked(isSupabaseConfigured).mockReturnValue(true);
  jest.mocked(loadPlanOptions).mockResolvedValue([monthly]);
  const { result } = await renderHook(() => usePaywall(undefined), { wrapper });

  await waitFor(() => expect(result.current.plans.kind).toBe('ready'));
  expect(result.current.requiresSignIn).toBe(true);
  expect(jest.mocked(syncPurchasesUser)).toHaveBeenCalledWith(null);
});

test('signed-in users can subscribe and RevenueCat follows their account', async () => {
  jest.mocked(isSupabaseConfigured).mockReturnValue(true);
  jest.mocked(useSession).mockReturnValue({ session: null, userId: 'user-1', isLoading: false });
  jest.mocked(loadPlanOptions).mockResolvedValue([monthly]);
  const { result } = await renderHook(() => usePaywall(undefined), { wrapper });

  await waitFor(() => expect(result.current.plans.kind).toBe('ready'));
  expect(result.current.requiresSignIn).toBe(false);
  expect(jest.mocked(syncPurchasesUser)).toHaveBeenCalledWith('user-1');
});
