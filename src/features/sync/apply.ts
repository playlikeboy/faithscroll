/**
 * Applying one pulled server row to the local database — the conflict rules live here.
 *
 * Rule: never silently overwrite the user's latest text. When a remote change arrives for a row
 * that still has a pending local change and the remote is newer than what this device last synced
 * (its "base" version) with different content, the local row is kept, both copies are saved to
 * `sync_conflicts`, and the local version is bumped above the remote one so the pending push wins
 * on the server and on other devices. Nothing is lost: the other copy stays restorable.
 *
 * Every function here is synchronous and runs inside the caller's transaction.
 */
import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';
import { nowIso } from '@/lib/time';

import {
  deleteEntityTag,
  deletePendingChanges,
  deleteRowById,
  deleteState,
  findNaturalKeyMatch,
  getBaseVersion,
  getState,
  hasPendingChange,
  insertRow,
  readEntityTag,
  readRow,
  recordConflict,
  setBaseVersion,
  setState,
  stateKeys,
  updateRow,
  type LocalRow,
  type SqlValue,
} from './local-store';
import type { RemoteRow } from './remote';
import { formatEntityTagKey, TIMESTAMP_COLUMNS, type EntityTagKey, type SyncTableConfig } from './tables';
import { toDeviceIso } from './timestamps';

export type ApplyResult =
  | 'inserted'
  | 'updated'
  | 'unchanged'
  | 'stale'
  | 'pending'
  | 'conflict'
  | 'collision'
  | 'deferred';

/** Columns compared to decide whether two copies differ in content. */
const IGNORED_FOR_CONTENT = new Set(['id', 'version', 'updated_at']);

function toSqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return JSON.stringify(value);
}

/** Server row → local row shape (synced columns only, device timestamp format). */
export function remoteToLocal(config: SyncTableConfig, remote: RemoteRow): LocalRow {
  const row: LocalRow = {};
  for (const column of config.syncedColumns) {
    const value = TIMESTAMP_COLUMNS.includes(column) ? toDeviceIso(remote[column]) : remote[column];
    row[column] = toSqlValue(value);
  }
  return row;
}

/** Local row → synced columns only (what is pushed and what conflict copies store). */
export function pickSynced(config: SyncTableConfig, local: LocalRow): LocalRow {
  const row: LocalRow = {};
  for (const column of config.syncedColumns) row[column] = local[column] ?? null;
  return row;
}

function comparable(column: string, value: SqlValue | undefined): SqlValue {
  if (value === undefined) return null;
  return TIMESTAMP_COLUMNS.includes(column) ? toSqlValue(toDeviceIso(value)) : value;
}

export function sameContent(config: SyncTableConfig, a: LocalRow, b: LocalRow): boolean {
  return config.syncedColumns
    .filter((column) => !IGNORED_FOR_CONTENT.has(column))
    .every((column) => comparable(column, a[column]) === comparable(column, b[column]));
}

type ConstraintKind = 'unique' | 'foreign_key' | null;

function constraintKind(error: unknown): ConstraintKind {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (/UNIQUE constraint failed/i.test(message)) return 'unique';
    if (/FOREIGN KEY constraint failed/i.test(message)) return 'foreign_key';
    current = current instanceof Error ? (current as Error & { cause?: unknown }).cause : undefined;
  }
  return null;
}

const DEFERRED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface DeferredEntry {
  row: RemoteRow;
  since: string;
}

/** Park a row whose parent hasn't arrived yet; it is retried after each pull. */
function deferRow(db: AppDatabase, tableName: string, rowKey: string, remote: RemoteRow): ApplyResult {
  const key = stateKeys.deferred(tableName, rowKey);
  const previous = getState(db, key);
  let since = nowIso();
  if (previous) {
    try {
      since = (JSON.parse(previous) as DeferredEntry).since ?? since;
    } catch {
      // keep the new timestamp
    }
  }
  setState(db, key, JSON.stringify({ row: remote, since } satisfies DeferredEntry));
  return 'deferred';
}

export function parseDeferred(value: string): DeferredEntry | null {
  try {
    const parsed = JSON.parse(value) as DeferredEntry;
    return parsed && typeof parsed === 'object' && parsed.row ? parsed : null;
  } catch {
    return null;
  }
}

export function isDeferredExpired(entry: DeferredEntry, now: Date): boolean {
  const since = Date.parse(entry.since);
  return Number.isFinite(since) && now.getTime() - since > DEFERRED_MAX_AGE_MS;
}

/** A remote row's natural key matches a different local row (e.g. the same verse highlighted on two devices). */
function resolveCollision(db: AppDatabase, config: SyncTableConfig, remote: LocalRow, exists: boolean): ApplyResult {
  const id = String(remote.id);
  const version = Number(remote.version);
  if (remote.deleted_at !== null) {
    setBaseVersion(db, config.entityType, id, version);
    return 'unchanged';
  }
  const existing = findNaturalKeyMatch(db, config.table, remote);
  if (!existing) throw new Error(`Unexpected unique constraint on ${config.table}`);
  const existingId = String(existing.id);
  if (existing.deleted_at !== null && !hasPendingChange(db, config.entityType, existingId)) {
    // The local duplicate was already deleted and synced: adopt the server row instead.
    deleteRowById(db, config.table, existingId);
    deleteState(db, stateKeys.base(config.entityType, existingId));
    if (exists) updateRow(db, config.table, id, remote);
    else insertRow(db, config.table, remote);
    setBaseVersion(db, config.entityType, id, version);
    return exists ? 'updated' : 'inserted';
  }
  recordConflict(db, config.entityType, existingId, pickSynced(config, existing), remote);
  // Remember the remote version so overlap re-reads don't record the same conflict again.
  setBaseVersion(db, config.entityType, id, version);
  return 'collision';
}

function writeRemote(db: AppDatabase, config: SyncTableConfig, remote: LocalRow, remoteRaw: RemoteRow, exists: boolean): ApplyResult {
  const id = String(remote.id);
  try {
    if (exists) updateRow(db, config.table, id, remote);
    else insertRow(db, config.table, remote);
  } catch (error) {
    const kind = constraintKind(error);
    if (kind === 'foreign_key') return deferRow(db, config.table, id, remoteRaw);
    if (kind === 'unique') return resolveCollision(db, config, remote, exists);
    throw error;
  }
  setBaseVersion(db, config.entityType, id, Number(remote.version));
  return exists ? 'updated' : 'inserted';
}

function applyVersioned(db: AppDatabase, config: SyncTableConfig, remoteRaw: RemoteRow): ApplyResult {
  const remote = remoteToLocal(config, remoteRaw);
  const id = String(remote.id);
  const remoteVersion = Number(remote.version);
  const local = readRow(db, config, id);
  const pending = hasPendingChange(db, config.entityType, id);
  const base = getBaseVersion(db, config.entityType, id);

  if (!local) {
    if (pending) return 'pending'; // deleted on this device; the pending delete will be pushed
    if (base !== null && remoteVersion <= base) return 'stale';
    return writeRemote(db, config, remote, remoteRaw, false);
  }

  const localVersion = Number(local.version);
  if (!pending) {
    if (remoteVersion < localVersion) return 'stale';
    if (remoteVersion === localVersion && sameContent(config, local, remote)) {
      setBaseVersion(db, config.entityType, id, remoteVersion);
      return 'unchanged';
    }
    return writeRemote(db, config, remote, remoteRaw, true);
  }

  // A local change is waiting to be pushed.
  if (base !== null && remoteVersion <= base) return 'stale'; // our own earlier push, or older
  if (sameContent(config, local, remote)) {
    setBaseVersion(db, config.entityType, id, remoteVersion);
    if (localVersion <= remoteVersion) {
      // The server already has exactly this content: nothing left to push.
      updateRow(db, config.table, id, { version: remoteVersion, updated_at: remote.updated_at });
      deletePendingChanges(db, config.entityType, id);
    }
    return 'unchanged';
  }

  recordConflict(db, config.entityType, id, pickSynced(config, local), remote);
  updateRow(db, config.table, id, { version: Math.max(localVersion, remoteVersion) + 1 });
  setBaseVersion(db, config.entityType, id, remoteVersion);
  logger.warn('Sync conflict kept the local copy', { table: config.table });
  return 'conflict';
}

function applyEntityTag(db: AppDatabase, remoteRaw: RemoteRow): ApplyResult {
  const key: EntityTagKey = {
    entity_type: String(remoteRaw.entity_type),
    entity_id: String(remoteRaw.entity_id),
    tag_id: String(remoteRaw.tag_id),
  };
  const composite = formatEntityTagKey(key);
  if (hasPendingChange(db, 'entity_tag', composite)) return 'pending';
  const local = readEntityTag(db, key);
  if (remoteRaw.deleted_at !== null && remoteRaw.deleted_at !== undefined) {
    if (!local) return 'unchanged';
    deleteEntityTag(db, key);
    return 'updated';
  }
  if (local) return 'unchanged';
  try {
    insertRow(db, 'entity_tags', { ...key, created_at: toSqlValue(toDeviceIso(remoteRaw.created_at)) ?? nowIso() });
  } catch (error) {
    const kind = constraintKind(error);
    if (kind === 'foreign_key') return deferRow(db, 'entity_tags', composite, remoteRaw);
    if (kind === 'unique') return 'unchanged';
    throw error;
  }
  return 'inserted';
}

export function applyRemoteRow(db: AppDatabase, config: SyncTableConfig, remoteRaw: RemoteRow): ApplyResult {
  return config.versioned ? applyVersioned(db, config, remoteRaw) : applyEntityTag(db, remoteRaw);
}

/** Server columns to select for a table (synced columns + the pull cursor). */
export function serverColumns(config: SyncTableConfig): string[] {
  if (config.versioned) return [...config.syncedColumns, 'server_updated_at'];
  return ['id', 'entity_type', 'entity_id', 'tag_id', 'created_at', 'updated_at', 'deleted_at', 'server_updated_at'];
}
