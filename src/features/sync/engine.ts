/**
 * One sync run: pull (with conflict rules) then push. Pull goes first so a device that was
 * offline for a while sees other devices' edits before it uploads its own, instead of blindly
 * overwriting them.
 */
import { sql } from 'drizzle-orm';

import type { AppDatabase } from '@/db/types';
import { nowIso } from '@/lib/time';

import { deleteState, deleteStateByPrefix, getState, setState, stateKeys } from './local-store';
import { pullAll } from './pull';
import { pushOutbox } from './push';
import type { SyncRemote } from './remote';
import { emptyStats, type SyncStats } from './stats';
import { SYNC_TABLES } from './tables';

const BOOKKEEPING_PREFIXES = ['pull:', 'base:', 'retry:', 'deferred:'] as const;

/** Forget cursors, base versions, retry timers and parked rows (keeps the outbox). */
export function resetSyncBookkeeping(db: AppDatabase): void {
  db.transaction((tx) => {
    for (const prefix of BOOKKEEPING_PREFIXES) deleteStateByPrefix(tx, prefix);
  });
}

/**
 * The cloud copy belongs to one account. If a different account signs in on this device, start
 * its sync from scratch (full pull). Local rows already uploaded to the previous account are not
 * copied into the new one; changes still in the outbox are.
 */
export function ensureSyncOwner(db: AppDatabase, userId: string): void {
  const owner = getState(db, stateKeys.owner);
  if (owner === userId) return;
  if (owner !== null) resetSyncBookkeeping(db);
  setState(db, stateKeys.owner, userId);
}

/**
 * After the account is deleted but the user keeps their data on this device: the data becomes
 * "signed-out local data" again, so everything is queued to upload to whichever account signs in next.
 */
export function prepareLocalDataForNextAccount(db: AppDatabase): void {
  const now = nowIso();
  db.transaction((tx) => {
    for (const prefix of BOOKKEEPING_PREFIXES) deleteStateByPrefix(tx, prefix);
    deleteState(tx, stateKeys.owner);
    tx.run(sql`DELETE FROM outbox`);
    for (const config of SYNC_TABLES) {
      if (config.versioned) {
        tx.run(
          sql`INSERT INTO outbox (entity_type, entity_id, operation, created_at)
              SELECT ${config.entityType}, id, 'upsert', ${now} FROM ${sql.identifier(config.table)} WHERE deleted_at IS NULL`,
        );
      } else {
        tx.run(
          sql`INSERT INTO outbox (entity_type, entity_id, operation, created_at)
              SELECT ${config.entityType}, entity_type || ':' || entity_id || ':' || tag_id, 'upsert', ${now} FROM entity_tags`,
        );
      }
    }
  });
}

export interface RunSyncOptions {
  db: AppDatabase;
  remote: SyncRemote;
  userId: string;
  now?: () => Date;
}

export async function runSync({ db, remote, userId, now = () => new Date() }: RunSyncOptions): Promise<SyncStats> {
  ensureSyncOwner(db, userId);
  const stats = emptyStats();
  await pullAll(db, remote, stats, now());
  await pushOutbox(db, remote, userId, now(), stats);
  return stats;
}
