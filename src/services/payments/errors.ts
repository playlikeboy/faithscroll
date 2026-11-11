import { PURCHASES_ERROR_CODE } from 'react-native-purchases';

export type PurchaseErrorKind =
  | 'cancelled'
  | 'pending'
  | 'network'
  | 'not_allowed'
  | 'already_owned'
  | 'unavailable'
  | 'store'
  | 'unknown';

export interface FriendlyPurchaseError {
  kind: PurchaseErrorKind;
  /** Calm, user-facing sentence. Never contains raw store/SDK messages. */
  message: string;
  /** RevenueCat error code, for logs only. */
  code: string | null;
}

interface PurchasesErrorLike {
  code: string;
  userCancelled?: boolean | null;
}

function isPurchasesErrorLike(error: unknown): error is PurchasesErrorLike {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string';
}

const MESSAGES: Record<PurchaseErrorKind, string> = {
  cancelled: 'Purchase cancelled. Nothing was charged.',
  pending:
    'Your purchase is waiting for approval. Plus will unlock automatically once it has been approved.',
  network: "We couldn't reach the store. Check your connection and try again.",
  not_allowed: 'Purchases are turned off on this device (for example by Screen Time or family settings).',
  already_owned: 'You already own this subscription. Try "Restore purchases" to unlock it on this device.',
  unavailable: "Subscriptions aren't available right now. Please try again later.",
  store: 'The store had a problem completing this request. Please try again in a moment.',
  unknown: 'Something went wrong with the store. Please try again in a moment.',
};

const CODE_TO_KIND: Partial<Record<string, PurchaseErrorKind>> = {
  [PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR]: 'cancelled',
  [PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR]: 'pending',
  [PURCHASES_ERROR_CODE.NETWORK_ERROR]: 'network',
  [PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR]: 'network',
  [PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR]: 'network',
  [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR]: 'not_allowed',
  [PURCHASES_ERROR_CODE.INSUFFICIENT_PERMISSIONS_ERROR]: 'not_allowed',
  [PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR]: 'already_owned',
  [PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR]: 'already_owned',
  [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR]: 'unavailable',
  [PURCHASES_ERROR_CODE.CONFIGURATION_ERROR]: 'unavailable',
  [PURCHASES_ERROR_CODE.UNSUPPORTED_ERROR]: 'unavailable',
  [PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR]: 'store',
  [PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR]: 'store',
  [PURCHASES_ERROR_CODE.INVALID_RECEIPT_ERROR]: 'store',
  [PURCHASES_ERROR_CODE.UNEXPECTED_BACKEND_RESPONSE_ERROR]: 'store',
  [PURCHASES_ERROR_CODE.UNKNOWN_BACKEND_ERROR]: 'store',
};

/** Map any RevenueCat / store error to a calm, user-facing message. */
export function toFriendlyPurchaseError(error: unknown): FriendlyPurchaseError {
  if (!isPurchasesErrorLike(error)) return { kind: 'unknown', message: MESSAGES.unknown, code: null };
  const kind: PurchaseErrorKind = error.userCancelled ? 'cancelled' : (CODE_TO_KIND[error.code] ?? 'unknown');
  return { kind, message: MESSAGES[kind], code: error.code };
}

/** The error shown when RevenueCat isn't configured in this build (Expo Go, missing keys). */
export function paymentsUnavailableError(): FriendlyPurchaseError {
  return {
    kind: 'unavailable',
    message: "Subscriptions aren't available in this version of the app. Everything free keeps working.",
    code: null,
  };
}
