/**
 * CONTRACT STUB — owned by the backend-auth agent (implemented).
 * Start background sync (outbox push / pull) and Supabase auth auto-refresh tied to AppState.
 * Must be a no-op when Supabase is not configured or the user is signed out.
 * Returns a cleanup function.
 *
 * - Token auto-refresh runs while the app is in the foreground (any signed-in feature needs it).
 * - Sync runs only when configured + signed in + cloud sync enabled + Plus active, triggered on
 *   start, foreground, every few minutes while open, sign-in, enabling sync, and shortly after
 *   local edits; failures retry with backoff (which also covers reconnecting).
 */
import { addDatabaseChangeListener } from 'expo-sqlite';
import { AppState, type AppStateStatus } from 'react-native';

import { db } from '@/db/client';
import { getSessionSnapshot, startSessionListener, subscribeToUserId } from '@/features/auth/session-store';
import { getSupabase } from '@/services/supabase/client';

import { createSyncCoordinator, type SyncCoordinator, type SyncReason } from './coordinator';
import { startEntitlementBridge } from './entitlement-bridge';
import { countOutbox } from './local-store';
import { isCloudSyncActive, useSyncStore } from './store';

export const SYNC_INTERVAL_MS = 5 * 60 * 1000;
export const LOCAL_CHANGE_DELAY_MS = 10_000;

let activeCoordinator: SyncCoordinator | null = null;

/** "Sync now" (Account screen). Resolves when the run finishes; no-op when sync can't run. */
export function syncNow(): Promise<void> {
  return activeCoordinator?.requestSync('manual') ?? Promise.resolve();
}

function createAppCoordinator(): SyncCoordinator {
  const store = useSyncStore.getState;
  return createSyncCoordinator({
    db,
    getClient: getSupabase,
    getUserId: () => getSessionSnapshot().session?.user.id ?? null,
    isEnabled: () => isCloudSyncActive(store()),
    onStart: () => store().markSyncing(),
    onSuccess: (at) => store().markSynced(at),
    onFailure: (problem) => store().markFailed(problem),
  });
}

export function initSync(): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;

  startSessionListener();
  const coordinator = createAppCoordinator();
  activeCoordinator = coordinator;
  const request = (reason: SyncReason) => void coordinator.requestSync(reason);

  let interval: ReturnType<typeof setInterval> | null = null;
  let localChangeTimer: ReturnType<typeof setTimeout> | null = null;

  const stopInterval = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };

  const handleAppState = (state: AppStateStatus) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
      if (!interval) interval = setInterval(() => request('interval'), SYNC_INTERVAL_MS);
      request('foreground');
    } else {
      void supabase.auth.stopAutoRefresh();
      stopInterval();
    }
  };

  const cleanups: (() => void)[] = [];
  const appStateSubscription = AppState.addEventListener('change', handleAppState);
  cleanups.push(() => appStateSubscription.remove());
  cleanups.push(startEntitlementBridge());
  cleanups.push(subscribeToUserId((userId) => userId && request('sign-in')));
  cleanups.push(
    useSyncStore.subscribe((state, previous) => {
      if (isCloudSyncActive(state) && !isCloudSyncActive(previous)) request('enabled');
    }),
  );

  // Upload soon after local edits (ignoring the sync's own outbox bookkeeping).
  const changeSubscription = addDatabaseChangeListener((event) => {
    if (event.tableName !== 'outbox' || coordinator.isRunning() || localChangeTimer) return;
    localChangeTimer = setTimeout(() => {
      localChangeTimer = null;
      if (countOutbox(db) > 0) request('local-change');
    }, LOCAL_CHANGE_DELAY_MS);
  });
  cleanups.push(() => changeSubscription.remove());

  handleAppState(AppState.currentState === 'background' ? 'background' : 'active');

  return () => {
    coordinator.stop();
    if (activeCoordinator === coordinator) activeCoordinator = null;
    stopInterval();
    if (localChangeTimer) clearTimeout(localChangeTimer);
    void supabase.auth.stopAutoRefresh();
    for (const cleanup of cleanups) cleanup();
  };
}
