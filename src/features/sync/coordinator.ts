/**
 * Runs sync on demand: one run at a time (requests during a run trigger exactly one follow-up),
 * only when eligible, with exponential backoff after failures. Backoff retries also stand in for
 * "sync on reconnect" (no network-state module is installed).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';

import { runSync } from './engine';
import { createSupabaseRemote, SyncRemoteError } from './remote';
import type { SyncStats } from './stats';
import type { SyncProblem } from './store';

export const RETRY_BASE_MS = 15_000;
export const RETRY_MAX_MS = 15 * 60 * 1000;

export type SyncReason = 'startup' | 'foreground' | 'interval' | 'sign-in' | 'enabled' | 'local-change' | 'manual' | 'retry';

export interface SyncCoordinatorDeps {
  db: AppDatabase;
  getClient: () => SupabaseClient | null;
  getUserId: () => string | null;
  isEnabled: () => boolean;
  onStart?: () => void;
  onSuccess?: (at: string, stats: SyncStats) => void;
  onFailure?: (problem: SyncProblem) => void;
  now?: () => Date;
}

export interface SyncCoordinator {
  requestSync: (reason: SyncReason) => Promise<void>;
  isRunning: () => boolean;
  stop: () => void;
}

export function classifySyncFailure(error: unknown): SyncProblem {
  if (error instanceof SyncRemoteError) {
    if (error.kind === 'network') return 'offline';
    if (error.kind === 'auth') return 'auth';
    return 'server';
  }
  return 'unknown';
}

export function retryDelay(failures: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, failures - 1));
}

export function createSyncCoordinator(deps: SyncCoordinatorDeps): SyncCoordinator {
  const now = deps.now ?? (() => new Date());
  let running: Promise<void> | null = null;
  let rerun = false;
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const eligible = () => !stopped && deps.isEnabled() && deps.getClient() !== null && deps.getUserId() !== null;

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  async function runOnce(): Promise<void> {
    const client = deps.getClient();
    const userId = deps.getUserId();
    if (!client || !userId) return;
    clearRetry();
    deps.onStart?.();
    try {
      const stats = await runSync({ db: deps.db, remote: createSupabaseRemote(client, userId), userId, now });
      failures = 0;
      deps.onSuccess?.(now().toISOString(), stats);
    } catch (error) {
      failures += 1;
      const problem = classifySyncFailure(error);
      if (problem === 'unknown') logger.error('Sync failed unexpectedly', error);
      else logger.warn('Sync failed', { problem, failures });
      deps.onFailure?.(problem);
      if (!stopped) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void requestSync('retry');
        }, retryDelay(failures));
      }
    }
  }

  function requestSync(_reason: SyncReason): Promise<void> {
    if (!eligible()) return Promise.resolve();
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      do {
        rerun = false;
        await runOnce();
      } while (rerun && eligible() && failures === 0);
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    requestSync,
    isRunning: () => running !== null,
    stop: () => {
      stopped = true;
      clearRetry();
    },
  };
}
