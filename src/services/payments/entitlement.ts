import type { CustomerInfo } from 'react-native-purchases';

import { PLUS_ENTITLEMENT_ID } from './environment';

/** Everything the UI needs to know about the user's Plus subscription (no store objects). */
export interface SubscriptionSnapshot {
  isPlus: boolean;
  /** ISO date when Plus expires (or expired), null for non-expiring grants or when never subscribed. */
  expiresAt: string | null;
  willRenew: boolean;
  isTrial: boolean;
  productId: string | null;
  /** RevenueCat store id, e.g. APP_STORE, PLAY_STORE, PROMOTIONAL. */
  store: string | null;
  /** Store page where the user manages/cancels the subscription, when RevenueCat knows it. */
  managementUrl: string | null;
  hasBillingIssue: boolean;
}

export const FREE_SNAPSHOT: SubscriptionSnapshot = {
  isPlus: false,
  expiresAt: null,
  willRenew: false,
  isTrial: false,
  productId: null,
  store: null,
  managementUrl: null,
  hasBillingIssue: false,
};

/** True when `expiresAt` is a valid date at or before `now`. Null means "does not expire". */
export function isExpired(expiresAt: string | null, now: number = Date.now()): boolean {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return Number.isFinite(time) && time <= now;
}

/**
 * Derive the Plus state from RevenueCat CustomerInfo. An entitlement whose expiry has already
 * passed is treated as inactive even if a stale cached CustomerInfo still lists it as active.
 */
export function toSubscriptionSnapshot(info: CustomerInfo, now: number = Date.now()): SubscriptionSnapshot {
  const entitlement = info.entitlements.active[PLUS_ENTITLEMENT_ID] ?? info.entitlements.all[PLUS_ENTITLEMENT_ID];
  if (!entitlement) return { ...FREE_SNAPSHOT, managementUrl: info.managementURL ?? null };

  const isPlus = entitlement.isActive && !isExpired(entitlement.expirationDate, now);
  return {
    isPlus,
    expiresAt: entitlement.expirationDate ?? null,
    willRenew: isPlus && entitlement.willRenew,
    isTrial: isPlus && entitlement.periodType === 'TRIAL',
    productId: entitlement.productIdentifier ?? null,
    store: entitlement.store ?? null,
    managementUrl: info.managementURL ?? null,
    hasBillingIssue: entitlement.billingIssueDetectedAt != null,
  };
}
