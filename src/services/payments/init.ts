/**
 * CONTRACT STUB — owned by the monetization agent (implemented).
 * Configure RevenueCat once at startup. A no-op when no API key is configured or the native
 * module is unavailable (Expo Go / web / tests), so the free experience always works.
 */
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { logger } from '@/lib/logger';

import { publishCustomerInfo, setEntitlementStatus } from './entitlement-store';
import { getRevenueCatApiKey, isNativePurchasesAvailable } from './environment';
import { watchSupabaseIdentity } from './identity';
import { refreshCustomerInfo } from './purchases';
import { isPaymentsConfigured, setPaymentsConfigured } from './runtime';

let attempted = false;

export function initPayments(): void {
  if (attempted) return;
  attempted = true;

  const apiKey = getRevenueCatApiKey();
  if (!apiKey || !isNativePurchasesAvailable()) {
    logger.debug('Payments disabled: no RevenueCat key or native module in this build');
    setEntitlementStatus('unavailable');
    return;
  }

  try {
    if (__DEV__) void Purchases.setLogLevel(LOG_LEVEL.WARN).catch(() => undefined);
    // Never collect advertising/device identifiers; RevenueCat only needs the app user id.
    Purchases.configure({ apiKey, automaticDeviceIdentifierCollectionEnabled: false });
    setPaymentsConfigured(true);
    setEntitlementStatus('loading');
    Purchases.addCustomerInfoUpdateListener(publishCustomerInfo);
    void refreshCustomerInfo();
    watchSupabaseIdentity();
  } catch (error) {
    setPaymentsConfigured(false);
    setEntitlementStatus('unavailable');
    logger.error('RevenueCat could not be configured', error);
  }
}

export { isPaymentsConfigured };

/** Test helper: allow `initPayments` to run again. */
export function resetPaymentsForTests(): void {
  attempted = false;
  setPaymentsConfigured(false);
  setEntitlementStatus('unavailable');
}
