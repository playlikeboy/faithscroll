import { PURCHASES_ERROR_CODE } from 'react-native-purchases';

import { paymentsUnavailableError, toFriendlyPurchaseError } from '@/services/payments/errors';

jest.mock('react-native-purchases', () =>
  jest.requireActual('@/services/payments/testing/purchases-mock').createPurchasesModuleMock(),
);

describe('toFriendlyPurchaseError', () => {
  test('a user cancelling is reported as cancelled, not as a failure', () => {
    const result = toFriendlyPurchaseError({ code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR, userCancelled: true });

    expect(result.kind).toBe('cancelled');
  });

  test('userCancelled wins over the error code', () => {
    expect(toFriendlyPurchaseError({ code: PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR, userCancelled: true }).kind).toBe('cancelled');
  });

  test.each([
    [PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR, 'pending'],
    [PURCHASES_ERROR_CODE.NETWORK_ERROR, 'network'],
    [PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR, 'network'],
    [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR, 'not_allowed'],
    [PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR, 'already_owned'],
    [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR, 'unavailable'],
    [PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR, 'store'],
    [PURCHASES_ERROR_CODE.UNKNOWN_ERROR, 'unknown'],
  ])('maps code %s to %s with a friendly message', (code, kind) => {
    const result = toFriendlyPurchaseError({ code, message: 'raw SDK message', userCancelled: false });

    expect(result.kind).toBe(kind);
    expect(result.code).toBe(code);
    expect(result.message).not.toContain('raw SDK message');
    expect(result.message.length).toBeGreaterThan(10);
  });

  test('non-RevenueCat errors become a generic message', () => {
    expect(toFriendlyPurchaseError(new Error('boom'))).toEqual(expect.objectContaining({ kind: 'unknown', code: null }));
    expect(toFriendlyPurchaseError(undefined).kind).toBe('unknown');
  });

  test('payments unavailable reassures that free features keep working', () => {
    expect(paymentsUnavailableError().message).toMatch(/free keeps working/);
  });
});
