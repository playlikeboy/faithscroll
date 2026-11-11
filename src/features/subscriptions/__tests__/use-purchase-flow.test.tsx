import { act, renderHook } from '@testing-library/react-native';
import { PACKAGE_TYPE } from 'react-native-purchases';

import { usePurchaseFlow } from '@/features/subscriptions/use-purchase-flow';
import { track } from '@/services/monitoring/analytics';
import type { PlanOption } from '@/services/payments/offerings';
import { purchasePlan, restorePlan } from '@/services/payments/purchases';
import { makePackage, makeProduct } from '@/services/payments/testing/fixtures';

jest.mock('react-native-purchases', () =>
  jest.requireActual('@/services/payments/testing/purchases-mock').createPurchasesModuleMock(),
);

jest.mock('@/services/payments/purchases', () => ({ purchasePlan: jest.fn(), restorePlan: jest.fn() }));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));

const mockedPurchase = jest.mocked(purchasePlan);
const mockedRestore = jest.mocked(restorePlan);
const mockedTrack = jest.mocked(track);

const option: PlanOption = {
  id: '$rc_monthly',
  productId: 'faithscroll_plus_monthly',
  period: 'monthly',
  title: 'Monthly',
  priceString: '$3.99',
  periodLabel: 'per month',
  monthlyEquivalent: null,
  trialLabel: null,
  pkg: makePackage(PACKAGE_TYPE.MONTHLY, makeProduct()),
};

beforeEach(() => jest.clearAllMocks());

test('a successful purchase tracks only the product id and shows a thank-you', async () => {
  mockedPurchase.mockResolvedValue({ status: 'purchased', productId: 'faithscroll_plus_monthly', isPlus: true });
  const { result } = await renderHook(() => usePurchaseFlow());

  let unlocked = false;
  await act(async () => {
    unlocked = await result.current.purchase(option);
  });

  expect(unlocked).toBe(true);
  expect(mockedTrack).toHaveBeenCalledWith({ name: 'purchase_completed', productId: 'faithscroll_plus_monthly' });
  expect(result.current.message).toMatchObject({ tone: 'success' });
  expect(result.current.busy).toBeNull();
});

test('cancelling shows no error message', async () => {
  mockedPurchase.mockResolvedValue({ status: 'cancelled' });
  const { result } = await renderHook(() => usePurchaseFlow());

  await act(async () => {
    await result.current.purchase(option);
  });

  expect(result.current.message).toBeNull();
  expect(mockedTrack).not.toHaveBeenCalled();
});

test('a failed purchase shows the friendly message', async () => {
  mockedPurchase.mockResolvedValue({ status: 'failed', error: { kind: 'network', message: 'Check your connection', code: '10' } });
  const { result } = await renderHook(() => usePurchaseFlow());

  await act(async () => {
    await result.current.purchase(option);
  });

  expect(result.current.message).toEqual({ tone: 'error', text: 'Check your connection' });
});

test('a pending purchase is informational', async () => {
  mockedPurchase.mockResolvedValue({ status: 'failed', error: { kind: 'pending', message: 'Waiting for approval', code: '20' } });
  const { result } = await renderHook(() => usePurchaseFlow());

  await act(async () => {
    await result.current.purchase(option);
  });

  expect(result.current.message?.tone).toBe('info');
});

test('restore tracks and confirms when Plus comes back', async () => {
  mockedRestore.mockResolvedValue({ status: 'restored', isPlus: true });
  const { result } = await renderHook(() => usePurchaseFlow());

  await act(async () => {
    await result.current.restore();
  });

  expect(mockedTrack).toHaveBeenCalledWith({ name: 'purchase_restored' });
  expect(result.current.message?.tone).toBe('success');
});

test('restore with nothing to restore explains calmly', async () => {
  mockedRestore.mockResolvedValue({ status: 'restored', isPlus: false });
  const { result } = await renderHook(() => usePurchaseFlow());

  await act(async () => {
    await result.current.restore();
  });

  expect(result.current.message?.tone).toBe('info');
  expect(mockedTrack).not.toHaveBeenCalled();

  await act(async () => result.current.clearMessage());
  expect(result.current.message).toBeNull();
});

test('restore failure shows the error', async () => {
  mockedRestore.mockResolvedValue({ status: 'failed', error: { kind: 'store', message: 'Store problem', code: '2' } });
  const { result } = await renderHook(() => usePurchaseFlow());

  await act(async () => {
    await result.current.restore();
  });

  expect(result.current.message).toEqual({ tone: 'error', text: 'Store problem' });
});
