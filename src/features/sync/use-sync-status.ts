import { useMemo } from 'react';

import type { AppDatabase } from '@/db/types';

import { countOpenConflicts, countOutbox } from './local-store';
import { useSyncStore, type SyncPhase, type SyncProblem } from './store';

export interface SyncStatus {
  cloudSyncEnabled: boolean;
  entitlementActive: boolean;
  phase: SyncPhase;
  problem: SyncProblem | null;
  lastSyncedAt: string | null;
  conflictsCount: number;
  pendingChanges: number;
}

/** Sync state for the Account screen; counts refresh after every sync run or conflict action. */
export function useSyncStatus(db: AppDatabase): SyncStatus {
  const cloudSyncEnabled = useSyncStore((s) => s.cloudSyncEnabled);
  const entitlementActive = useSyncStore((s) => s.entitlementActive);
  const phase = useSyncStore((s) => s.phase);
  const problem = useSyncStore((s) => s.problem);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const revision = useSyncStore((s) => s.revision);

  const counts = useMemo(() => {
    void revision;
    return { conflictsCount: countOpenConflicts(db), pendingChanges: countOutbox(db) };
  }, [db, revision]);

  return { cloudSyncEnabled, entitlementActive, phase, problem, lastSyncedAt, ...counts };
}

const PROBLEM_MESSAGES: Record<SyncProblem, string> = {
  offline: "You're offline. Changes are saved on this device and will sync when you're back online.",
  server: "The sync service didn't respond. We'll try again shortly.",
  auth: 'Your session needs to be renewed. If this continues, sign out and sign in again.',
  unknown: "Something went wrong while syncing. Your notes are safe on this device; we'll try again.",
};

export function syncProblemMessage(problem: SyncProblem): string {
  return PROBLEM_MESSAGES[problem];
}

/** "Just now", "5 minutes ago", "Yesterday at 9:41 AM" style label. */
export function formatLastSynced(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Not synced yet';
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return 'Not synced yet';
  const minutes = Math.floor((now.getTime() - time) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const date = new Date(time);
  const timeLabel = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Today at ${timeLabel}`;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeLabel}`;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${timeLabel}`;
}
