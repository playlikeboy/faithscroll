import type { CustomerInfo } from 'react-native-purchases';
import { create } from 'zustand';

import { FREE_SNAPSHOT, isExpired, toSubscriptionSnapshot, type SubscriptionSnapshot } from './entitlement';

/**
 * - `unavailable`: payments not configured in this build (no key, Expo Go, web, tests) → free tier.
 * - `loading`: configured, waiting for the first CustomerInfo.
 * - `ready`: snapshot reflects RevenueCat.
 * - `error`: CustomerInfo could not be loaded (e.g. offline on first launch); free tier until it arrives.
 */
export type EntitlementStatus = 'unavailable' | 'loading' | 'ready' | 'error';

export interface EntitlementStoreState {
  status: EntitlementStatus;
  snapshot: SubscriptionSnapshot;
}

/** Longest timer we schedule to flip Plus off at its expiry while the app stays open. */
const MAX_EXPIRY_TIMER_MS = 24 * 60 * 60 * 1000;

/** In-memory mirror of RevenueCat CustomerInfo. RevenueCat itself caches it on the device. */
export const useEntitlementStore = create<EntitlementStoreState>()(() => ({
  status: 'unavailable',
  snapshot: FREE_SNAPSHOT,
}));

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

function clearExpiryTimer(): void {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
}

/** If Plus ends while the app is open (and no store update arrives), drop to the free tier on time. */
function scheduleExpiryCheck(snapshot: SubscriptionSnapshot): void {
  clearExpiryTimer();
  if (!snapshot.isPlus || !snapshot.expiresAt) return;
  const delay = Date.parse(snapshot.expiresAt) - Date.now();
  if (!Number.isFinite(delay) || delay > MAX_EXPIRY_TIMER_MS) return;
  expiryTimer = setTimeout(() => {
    expiryTimer = null;
    const current = useEntitlementStore.getState().snapshot;
    if (current.isPlus && isExpired(current.expiresAt)) {
      useEntitlementStore.setState({ snapshot: { ...current, isPlus: false, willRenew: false, isTrial: false } });
    }
  }, Math.max(0, delay));
}

export function publishCustomerInfo(info: CustomerInfo): SubscriptionSnapshot {
  const snapshot = toSubscriptionSnapshot(info);
  useEntitlementStore.setState({ status: 'ready', snapshot });
  scheduleExpiryCheck(snapshot);
  return snapshot;
}

export function setEntitlementStatus(status: EntitlementStatus): void {
  if (status === 'unavailable') clearExpiryTimer();
  useEntitlementStore.setState((state) => ({
    status,
    snapshot: status === 'unavailable' ? FREE_SNAPSHOT : state.snapshot,
  }));
}
