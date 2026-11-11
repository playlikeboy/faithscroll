/**
 * Test-only replacement for `react-native-purchases`. The real package cannot load under Jest
 * (it pulls in an ESM-only dependency), so tests mock it with:
 *
 *   jest.mock('react-native-purchases', () =>
 *     jest.requireActual('@/services/payments/testing/purchases-mock').createPurchasesModuleMock());
 *
 * Enum values mirror @revenuecat/purchases-typescript-internal.
 */
export const PURCHASES_ERROR_CODE = {
  UNKNOWN_ERROR: '0',
  PURCHASE_CANCELLED_ERROR: '1',
  STORE_PROBLEM_ERROR: '2',
  PURCHASE_NOT_ALLOWED_ERROR: '3',
  PURCHASE_INVALID_ERROR: '4',
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: '5',
  PRODUCT_ALREADY_PURCHASED_ERROR: '6',
  RECEIPT_ALREADY_IN_USE_ERROR: '7',
  INVALID_RECEIPT_ERROR: '8',
  NETWORK_ERROR: '10',
  UNEXPECTED_BACKEND_RESPONSE_ERROR: '12',
  UNKNOWN_BACKEND_ERROR: '16',
  INSUFFICIENT_PERMISSIONS_ERROR: '19',
  PAYMENT_PENDING_ERROR: '20',
  CONFIGURATION_ERROR: '23',
  UNSUPPORTED_ERROR: '24',
  PRODUCT_REQUEST_TIMED_OUT_ERROR: '32',
  OFFLINE_CONNECTION_ERROR: '35',
} as const;

export const PACKAGE_TYPE = {
  UNKNOWN: 'UNKNOWN',
  CUSTOM: 'CUSTOM',
  LIFETIME: 'LIFETIME',
  ANNUAL: 'ANNUAL',
  SIX_MONTH: 'SIX_MONTH',
  THREE_MONTH: 'THREE_MONTH',
  TWO_MONTH: 'TWO_MONTH',
  MONTHLY: 'MONTHLY',
  WEEKLY: 'WEEKLY',
} as const;

export const INTRO_ELIGIBILITY_STATUS = {
  INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0,
  INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1,
  INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2,
  INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS: 3,
} as const;

export const LOG_LEVEL = { VERBOSE: 'VERBOSE', DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' } as const;

export function createPurchasesModuleMock() {
  return {
    __esModule: true,
    default: {
      configure: jest.fn(),
      setLogLevel: jest.fn(async () => undefined),
      addCustomerInfoUpdateListener: jest.fn(),
      removeCustomerInfoUpdateListener: jest.fn(),
      getCustomerInfo: jest.fn(),
      getOfferings: jest.fn(),
      checkTrialOrIntroductoryPriceEligibility: jest.fn(),
      purchasePackage: jest.fn(),
      restorePurchases: jest.fn(),
      logIn: jest.fn(),
      logOut: jest.fn(),
      isAnonymous: jest.fn(),
      showManageSubscriptions: jest.fn(async () => undefined),
    },
    PURCHASES_ERROR_CODE,
    PACKAGE_TYPE,
    INTRO_ELIGIBILITY_STATUS,
    LOG_LEVEL,
  };
}
