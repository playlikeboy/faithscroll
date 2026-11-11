/**
 * CONTRACT STUB — owned by the monetization agent (implemented).
 * "Faithscroll Plus" entitlement state from RevenueCat (entitlement id `plus`).
 * Free tier (`isPlus: false`, not loading) whenever payments aren't configured.
 */
import { isExpired, type SubscriptionSnapshot } from '@/services/payments/entitlement';
import { useEntitlementStore, type EntitlementStatus } from '@/services/payments/entitlement-store';

export interface EntitlementState {
  isPlus: boolean;
  isLoading: boolean;
  /** ISO date when Plus expires, if known. */
  expiresAt: string | null;
}

export function useEntitlements(): EntitlementState {
  const status = useEntitlementStore((state) => state.status);
  const snapshot = useEntitlementStore((state) => state.snapshot);
  return {
    isPlus: snapshot.isPlus && !isExpired(snapshot.expiresAt),
    isLoading: status === 'loading',
    expiresAt: snapshot.expiresAt,
  };
}

export interface SubscriptionStatus {
  status: EntitlementStatus;
  /** False when this build can't sell subscriptions (no keys, Expo Go, web). */
  isAvailable: boolean;
  snapshot: SubscriptionSnapshot;
}

/** Full subscription details for the subscription settings screen and the paywall. */
export function useSubscriptionStatus(): SubscriptionStatus {
  const status = useEntitlementStore((state) => state.status);
  const snapshot = useEntitlementStore((state) => state.snapshot);
  const isPlus = snapshot.isPlus && !isExpired(snapshot.expiresAt);
  return {
    status,
    isAvailable: status !== 'unavailable',
    snapshot: isPlus === snapshot.isPlus ? snapshot : { ...snapshot, isPlus, willRenew: false, isTrial: false },
  };
}
