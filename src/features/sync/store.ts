/**
 * Cloud sync UI/state. `cloudSyncEnabled` is the user's choice (Account screen); sync only runs
 * while it is on AND Faithscroll Plus is active (`entitlementActive`, mirrored from payments).
 * Turning sync off (or Plus lapsing) never deletes anything — local data stays, the cloud copy stays.
 */
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SyncPhase = 'idle' | 'syncing';
/** Why the last sync failed (never contains server text or user content). */
export type SyncProblem = 'offline' | 'server' | 'auth' | 'unknown';

export interface SyncStoreState {
  cloudSyncEnabled: boolean;
  /** Last known Plus status (persisted so sync keeps working when payments can't be reached). */
  entitlementActive: boolean;
  lastSyncedAt: string | null;
  phase: SyncPhase;
  problem: SyncProblem | null;
  /** Bumped whenever local sync bookkeeping changes, so views can re-read counts. */
  revision: number;

  setCloudSyncEnabled: (enabled: boolean) => void;
  setEntitlementActive: (active: boolean) => void;
  markSyncing: () => void;
  markSynced: (at: string) => void;
  markFailed: (problem: SyncProblem) => void;
  bumpRevision: () => void;
  resetSyncStatus: () => void;
}

const initial = {
  cloudSyncEnabled: false,
  entitlementActive: false,
  lastSyncedAt: null,
  phase: 'idle' as SyncPhase,
  problem: null,
  revision: 0,
};

export const useSyncStore = create<SyncStoreState>()(
  persist(
    (set) => ({
      ...initial,
      setCloudSyncEnabled: (cloudSyncEnabled) => set({ cloudSyncEnabled, problem: null }),
      setEntitlementActive: (entitlementActive) => set({ entitlementActive }),
      markSyncing: () => set({ phase: 'syncing' }),
      markSynced: (lastSyncedAt) => set((s) => ({ phase: 'idle', problem: null, lastSyncedAt, revision: s.revision + 1 })),
      markFailed: (problem) => set((s) => ({ phase: 'idle', problem, revision: s.revision + 1 })),
      bumpRevision: () => set((s) => ({ revision: s.revision + 1 })),
      resetSyncStatus: () => set((s) => ({ lastSyncedAt: null, problem: null, phase: 'idle', revision: s.revision + 1 })),
    }),
    {
      name: 'faithscroll.sync',
      version: 1,
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({
        cloudSyncEnabled: state.cloudSyncEnabled,
        entitlementActive: state.entitlementActive,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);

export function isCloudSyncActive(state: Pick<SyncStoreState, 'cloudSyncEnabled' | 'entitlementActive'>): boolean {
  return state.cloudSyncEnabled && state.entitlementActive;
}
