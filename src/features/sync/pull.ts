/**
 * Pull: for each table (parents first), page through server rows changed since the stored cursor
 * and apply them. Each run re-reads a short overlap window before the cursor so rows committed
 * late (with an earlier server timestamp) are never missed; re-applying a row is idempotent.
 */
import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';

import { applyRemoteRow, isDeferredExpired, parseDeferred, serverColumns, type ApplyResult } from './apply';
import { deleteState, getState, listStateByPrefix, setState, stateKeys } from './local-store';
import type { PullCursor, SyncRemote } from './remote';
import type { SyncStats } from './stats';
import { SYNC_TABLES, type SyncTableConfig } from './tables';
import { maxTimestamp, shiftBack } from './timestamps';

export const PULL_PAGE_SIZE = 200;
export const PULL_OVERLAP_MS = 60_000;

export function countResult(stats: SyncStats, result: ApplyResult): void {
  if (result === 'inserted' || result === 'updated') stats.pulled += 1;
  else if (result === 'conflict' || result === 'collision') stats.conflicts += 1;
}

export async function pullTable(db: AppDatabase, remote: SyncRemote, config: SyncTableConfig, stats: SyncStats): Promise<void> {
  const cursorKey = stateKeys.cursor(config.table);
  const stored = getState(db, cursorKey);
  let after: PullCursor | null = stored ? { ts: shiftBack(stored, PULL_OVERLAP_MS), id: null } : null;
  const columns = serverColumns(config);

  for (;;) {
    const rows = await remote.pullPage(config.table, columns, after, PULL_PAGE_SIZE);
    if (rows.length === 0) return;

    db.transaction((tx) => {
      let cursor = getState(tx, cursorKey);
      for (const row of rows) {
        countResult(stats, applyRemoteRow(tx, config, row));
        cursor = maxTimestamp(cursor, typeof row.server_updated_at === 'string' ? row.server_updated_at : null);
      }
      if (cursor) setState(tx, cursorKey, cursor);
    });

    const last = rows[rows.length - 1];
    after = { ts: String(last.server_updated_at), id: String(last.id) };
    if (rows.length < PULL_PAGE_SIZE) return;
  }
}

/** Retry rows parked because their parent hadn't arrived; drop ones older than 30 days. */
export function retryDeferred(db: AppDatabase, stats: SyncStats, now: Date): void {
  for (const config of SYNC_TABLES) {
    for (const entry of listStateByPrefix(db, `deferred:${config.table}:`)) {
      const parsed = parseDeferred(entry.value);
      db.transaction((tx) => {
        if (!parsed) {
          deleteState(tx, entry.key);
          return;
        }
        // A row that is still missing its parent re-defers under the same key, keeping `since`.
        const result = applyRemoteRow(tx, config, parsed.row);
        if (result !== 'deferred') {
          deleteState(tx, entry.key);
          countResult(stats, result);
        } else if (isDeferredExpired(parsed, now)) {
          deleteState(tx, entry.key);
          logger.warn('Dropped a synced row whose parent never arrived', { table: config.table });
        }
      });
    }
  }
}

export async function pullAll(db: AppDatabase, remote: SyncRemote, stats: SyncStats, now: Date): Promise<void> {
  for (const config of SYNC_TABLES) await pullTable(db, remote, config, stats);
  retryDeferred(db, stats, now);
  stats.deferred = listStateByPrefix(db, 'deferred:').length;
}
