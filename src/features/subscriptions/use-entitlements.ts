/**
 * CONTRACT STUB — owned by the monetization agent.
 * "Faithscroll Plus" entitlement state from RevenueCat.
 */
export interface EntitlementState {
  isPlus: boolean;
  isLoading: boolean;
  /** ISO date when Plus expires, if known. */
  expiresAt: string | null;
}

export function useEntitlements(): EntitlementState {
  return { isPlus: false, isLoading: false, expiresAt: null };
}
