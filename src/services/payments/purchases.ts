import { Linking, Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { logger } from '@/lib/logger';

import { publishCustomerInfo, setEntitlementStatus } from './entitlement-store';
import { paymentsUnavailableError, toFriendlyPurchaseError, type FriendlyPurchaseError } from './errors';
import { waitForPurchasesIdentity } from './identity';
import { isPaymentsConfigured } from './runtime';

export type PurchaseOutcome =
  | { status: 'purchased'; productId: string; isPlus: boolean }
  | { status: 'cancelled' }
  | { status: 'failed'; error: FriendlyPurchaseError };

export type RestoreOutcome = { status: 'restored'; isPlus: boolean } | { status: 'failed'; error: FriendlyPurchaseError };

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

/** Buy a package. A user cancelling is a normal outcome, not an error. */
export async function purchasePlan(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!isPaymentsConfigured()) return { status: 'failed', error: paymentsUnavailableError() };
  await waitForPurchasesIdentity();
  try {
    const result = await Purchases.purchasePackage(pkg);
    const snapshot = publishCustomerInfo(result.customerInfo);
    return { status: 'purchased', productId: result.productIdentifier, isPlus: snapshot.isPlus };
  } catch (error) {
    const friendly = toFriendlyPurchaseError(error);
    if (friendly.kind === 'cancelled') return { status: 'cancelled' };
    if (friendly.kind !== 'pending') logger.error('Purchase failed', error, { code: friendly.code ?? 'none' });
    return { status: 'failed', error: friendly };
  }
}

/** Restore previous purchases for the current store account. */
export async function restorePlan(): Promise<RestoreOutcome> {
  if (!isPaymentsConfigured()) return { status: 'failed', error: paymentsUnavailableError() };
  await waitForPurchasesIdentity();
  try {
    const snapshot = publishCustomerInfo(await Purchases.restorePurchases());
    return { status: 'restored', isPlus: snapshot.isPlus };
  } catch (error) {
    const friendly = toFriendlyPurchaseError(error);
    logger.error('Restore purchases failed', error, { code: friendly.code ?? 'none' });
    return { status: 'failed', error: friendly };
  }
}

/** Fetch the latest CustomerInfo into the entitlement store. Never throws. */
export async function refreshCustomerInfo(): Promise<void> {
  if (!isPaymentsConfigured()) return;
  try {
    publishCustomerInfo(await Purchases.getCustomerInfo());
  } catch (error) {
    logger.warn('Could not refresh subscription status', { code: toFriendlyPurchaseError(error).code ?? 'none' });
    setEntitlementStatus('error');
  }
}

/**
 * Open the platform's subscription management UI. Returns false if nothing could be opened.
 * iOS: the native App Store sheet when available. Android: RevenueCat's management URL or Play.
 */
export async function openManageSubscriptions(managementUrl: string | null): Promise<boolean> {
  try {
    if (Platform.OS === 'ios' && isPaymentsConfigured()) {
      await Purchases.showManageSubscriptions();
      return true;
    }
    const fallback = Platform.OS === 'android' ? PLAY_SUBSCRIPTIONS_URL : APPLE_SUBSCRIPTIONS_URL;
    await Linking.openURL(managementUrl ?? fallback);
    return true;
  } catch (error) {
    logger.error('Could not open subscription management', error);
    return false;
  }
}
