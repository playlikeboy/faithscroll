/**
 * Mirrors the Plus entitlement (payments store) into the sync store outside React, so sync can
 * stop when Plus lapses even if no screen is mounted. While payments are loading or unreachable
 * the last known value is kept, so a Plus user offline at launch still syncs once back online.
 */
import { isExpired } from '@/services/payments/entitlement';
import { useEntitlementStore, type EntitlementStoreState } from '@/services/payments/entitlement-store';

import { useSyncStore } from './store';

function resolve(state: EntitlementStoreState): boolean | null {
  if (state.status === 'ready') return state.snapshot.isPlus && !isExpired(state.snapshot.expiresAt);
  if (state.status === 'unavailable') return false;
  return null; // loading / error: keep last known
}

function publish(state: EntitlementStoreState): void {
  const active = resolve(state);
  if (active !== null && active !== useSyncStore.getState().entitlementActive) {
    useSyncStore.getState().setEntitlementActive(active);
  }
}

export function startEntitlementBridge(): () => void {
  publish(useEntitlementStore.getState());
  return useEntitlementStore.subscribe(publish);
}
