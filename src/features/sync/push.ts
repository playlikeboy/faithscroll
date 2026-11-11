/**
 * Push: send pending local changes from the outbox.
 *
 * - Coalesce: many outbox entries for one entity → one upsert of the row as it is now.
 * - Rows still on the device are upserted in batches (soft deletes travel as tombstones);
 *   rows gone from the device are tombstoned on the server.
 * - The server skips stale versions; those rows are fetched and run through the conflict rules,
 *   and their entries stay queued for the next sync.
 * - A batch the server rejects is retried row by row so one bad row can't block the rest; failing
 *   rows back off exponentially (attempts / last_error / retry time).
 * - Network/auth/server failures abort the push; the outbox is untouched and retried later.
 */
import { sql } from 'drizzle-orm';

import type { EntityType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';

import { applyRemoteRow, pickSynced, serverColumns } from './apply';
import {
  deleteOutboxEntries,
  deleteState,
  getState,
  hasPendingChange,
  markOutboxFailure,
  readEntityTag,
  readRow,
  setBaseVersion,
  setState,
  stateKeys,
  type LocalRow,
} from './local-store';
import { countResult } from './pull';
import { SyncRemoteError, type RemoteRow, type SyncRemote } from './remote';
import type { SyncStats } from './stats';
import { parseEntityTagKey, SYNC_TABLES, type SyncTableConfig } from './tables';

export const PUSH_BATCH_SIZE = 100;
export const OUTBOX_PAGE_SIZE = 500;
const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 6 * 60 * 60 * 1000;
const ENTITY_TAG_CONFLICT = 'user_id,entity_type,entity_id,tag_id';

export interface PendingGroup {
  entityType: EntityType;
  entityId: string;
  /** Outbox ids read for this entity; only these are removed on success. */
  entryIds: number[];
  attempts: number;
}

interface PushContext {
  db: AppDatabase;
  remote: SyncRemote;
  userId: string;
  now: Date;
  stats: SyncStats;
}

export function retryDelayMs(attempts: number): number {
  return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** Math.max(0, attempts));
}

/** Reads outbox entries with id > afterId and groups them per entity (all of that entity's entries). */
export function readPendingGroups(db: AppDatabase, afterId: number, limit: number): { groups: PendingGroup[]; lastId: number } {
  const page = db.all<{ id: number; entity_type: EntityType; entity_id: string }>(
    sql`SELECT id, entity_type, entity_id FROM outbox WHERE id > ${afterId} ORDER BY id LIMIT ${limit}`,
  );
  const groups = new Map<string, PendingGroup>();
  for (const entry of page) {
    const key = `${entry.entity_type}\u0000${entry.entity_id}`;
    if (groups.has(key)) continue;
    const all = db.all<{ id: number; attempts: number }>(
      sql`SELECT id, attempts FROM outbox WHERE entity_type = ${entry.entity_type} AND entity_id = ${entry.entity_id} ORDER BY id`,
    );
    groups.set(key, {
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      entryIds: all.map((row) => row.id),
      attempts: Math.max(0, ...all.map((row) => row.attempts)),
    });
  }
  return { groups: [...groups.values()], lastId: page.length > 0 ? page[page.length - 1].id : afterId };
}

function isDue(db: AppDatabase, group: PendingGroup, now: Date): boolean {
  const retryAt = getState(db, stateKeys.retry(group.entityType, group.entityId));
  return retryAt === null || Date.parse(retryAt) <= now.getTime();
}

function succeed(ctx: PushContext, group: PendingGroup, version: number | null): void {
  const { db } = ctx;
  deleteOutboxEntries(db, group.entryIds);
  deleteState(db, stateKeys.retry(group.entityType, group.entityId));
  if (version !== null) setBaseVersion(db, group.entityType, group.entityId, version);
  ctx.stats.pushed += 1;
}

function fail(ctx: PushContext, group: PendingGroup, code: string): void {
  const { db, now } = ctx;
  markOutboxFailure(db, group.entryIds, code);
  const retryAt = new Date(now.getTime() + retryDelayMs(group.attempts)).toISOString();
  setState(db, stateKeys.retry(group.entityType, group.entityId), retryAt);
  ctx.stats.failed += 1;
  logger.warn('Sync could not upload a change', { entityType: group.entityType, code, attempts: group.attempts + 1 });
}

function isRejection(error: unknown): error is SyncRemoteError {
  return error instanceof SyncRemoteError && error.kind === 'rejected';
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

interface UpsertItem {
  group: PendingGroup;
  payload: RemoteRow;
  version: number | null;
  /** Identity of the row in the server's returned representation. */
  key: string;
}

interface UpsertOutcome {
  /** Keys the server wrote. */
  accepted: Set<string>;
  /** Keys the server refused (marked failed, retried later with backoff). */
  refused: Set<string>;
}

/**
 * Upserts a batch; on a data rejection retries each row alone so one bad row can't block the rest.
 * Keys in neither set were skipped by the server's version guard (stale).
 */
async function upsertIsolated(
  ctx: PushContext,
  table: string,
  items: UpsertItem[],
  onConflict: string,
  returning: string,
  keyOf: (row: RemoteRow) => string,
): Promise<UpsertOutcome> {
  try {
    const written = await ctx.remote.upsert(table, items.map((item) => item.payload), onConflict, returning);
    return { accepted: new Set(written.map(keyOf)), refused: new Set() };
  } catch (error) {
    if (!isRejection(error)) throw error;
    if (items.length === 1) {
      fail(ctx, items[0].group, error.code);
      return { accepted: new Set(), refused: new Set([items[0].key]) };
    }
    const outcome: UpsertOutcome = { accepted: new Set(), refused: new Set() };
    for (const item of items) {
      const single = await upsertIsolated(ctx, table, [item], onConflict, returning, keyOf);
      single.accepted.forEach((key) => outcome.accepted.add(key));
      single.refused.forEach((key) => outcome.refused.add(key));
    }
    return outcome;
  }
}

async function markDeletedSafely(ctx: PushContext, table: string, group: PendingGroup, match: Record<string, string>): Promise<void> {
  try {
    await ctx.remote.markDeleted(table, match, ctx.now.toISOString());
    ctx.db.transaction((tx) => succeed({ ...ctx, db: tx }, group, null));
  } catch (error) {
    if (!isRejection(error)) throw error;
    fail(ctx, group, error.code);
  }
}

/** Server refused stale versions: fetch the newer server rows and run the conflict rules now. */
async function reconcileStale(ctx: PushContext, config: SyncTableConfig, stale: UpsertItem[]): Promise<void> {
  if (stale.length === 0) return;
  const rows = await ctx.remote.fetchByIds(config.table, serverColumns(config), stale.map((item) => item.key));
  ctx.db.transaction((tx) => {
    for (const row of rows) countResult(ctx.stats, applyRemoteRow(tx, config, row));
    for (const item of stale) {
      if (hasPendingChange(tx, item.group.entityType, item.group.entityId)) {
        // Retried on the next sync without backoff: the local copy now carries a higher version.
        markOutboxFailure(tx, item.group.entryIds, 'version_conflict');
      }
    }
  });
}

async function pushVersioned(ctx: PushContext, config: SyncTableConfig, groups: PendingGroup[]): Promise<void> {
  const items: UpsertItem[] = [];
  const gone: PendingGroup[] = [];
  for (const group of groups) {
    const row = readRow(ctx.db, config, group.entityId);
    if (!row) {
      gone.push(group);
      continue;
    }
    const payload: RemoteRow = { ...pickSynced(config, row), user_id: ctx.userId };
    items.push({ group, payload, version: Number(row.version), key: group.entityId });
  }

  for (const batch of chunk(items, PUSH_BATCH_SIZE)) {
    const { accepted, refused } = await upsertIsolated(ctx, config.table, batch, 'id', 'id', (row) => String(row.id));
    ctx.db.transaction((tx) => {
      for (const item of batch) if (accepted.has(item.key)) succeed({ ...ctx, db: tx }, item.group, item.version);
    });
    // Neither written nor refused → the server's version guard skipped a stale write.
    const stale = batch.filter((item) => !accepted.has(item.key) && !refused.has(item.key));
    await reconcileStale(ctx, config, stale);
  }

  for (const group of gone) await markDeletedSafely(ctx, config.table, group, { id: group.entityId });
}

async function pushEntityTags(ctx: PushContext, groups: PendingGroup[]): Promise<void> {
  const items: UpsertItem[] = [];
  for (const group of groups) {
    const key = parseEntityTagKey(group.entityId);
    if (!key) {
      logger.warn('Dropped a malformed entity tag change from the sync queue');
      deleteOutboxEntries(ctx.db, group.entryIds);
      continue;
    }
    const local: LocalRow | undefined = readEntityTag(ctx.db, key);
    if (!local) {
      await markDeletedSafely(ctx, 'entity_tags', group, { ...key });
      continue;
    }
    const nowIso = ctx.now.toISOString();
    items.push({
      group,
      payload: { ...key, user_id: ctx.userId, created_at: local.created_at, updated_at: nowIso, deleted_at: null },
      version: null,
      key: group.entityId,
    });
  }
  for (const batch of chunk(items, PUSH_BATCH_SIZE)) {
    const { accepted } = await upsertIsolated(ctx, 'entity_tags', batch, ENTITY_TAG_CONFLICT, 'entity_type,entity_id,tag_id', (row) =>
      [row.entity_type, row.entity_id, row.tag_id].map(String).join(':'),
    );
    ctx.db.transaction((tx) => {
      for (const item of batch) if (accepted.has(item.key)) succeed({ ...ctx, db: tx }, item.group, null);
    });
  }
}

export async function pushOutbox(db: AppDatabase, remote: SyncRemote, userId: string, now: Date, stats: SyncStats): Promise<void> {
  const ctx: PushContext = { db, remote, userId, now, stats };
  let afterId = 0;
  for (;;) {
    const { groups, lastId } = readPendingGroups(db, afterId, OUTBOX_PAGE_SIZE);
    if (lastId === afterId) return;
    afterId = lastId;
    const due = groups.filter((group) => isDue(db, group, now));
    for (const config of SYNC_TABLES) {
      const tableGroups = due.filter((group) => group.entityType === config.entityType);
      if (tableGroups.length === 0) continue;
      if (config.versioned) await pushVersioned(ctx, config, tableGroups);
      else await pushEntityTags(ctx, tableGroups);
    }
  }
}
