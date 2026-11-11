/**
 * Raw-SQL access to local rows and sync bookkeeping (outbox, sync_state, sync_conflicts).
 * Rows are plain snake_case records, exactly as SQLite stores them and the server mirrors them.
 */
import { sql, type SQL } from 'drizzle-orm';

import type { EntityType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import { NATURAL_KEYS, type EntityTagKey, type SyncTableConfig } from './tables';

export type SqlValue = string | number | null;
export type LocalRow = Record<string, SqlValue>;

// ---------------------------------------------------------------------------
// User rows
// ---------------------------------------------------------------------------

const table = (name: string) => sql.identifier(name);

export function readRow(db: AppDatabase, config: SyncTableConfig, id: string): LocalRow | undefined {
  return db.get<LocalRow | undefined>(sql`SELECT * FROM ${table(config.table)} WHERE id = ${id}`);
}

export function readEntityTag(db: AppDatabase, key: EntityTagKey): LocalRow | undefined {
  return db.get<LocalRow | undefined>(
    sql`SELECT * FROM entity_tags WHERE entity_type = ${key.entity_type} AND entity_id = ${key.entity_id} AND tag_id = ${key.tag_id}`,
  );
}

export function insertRow(db: AppDatabase, tableName: string, values: LocalRow): void {
  const columns = Object.keys(values);
  db.run(
    sql`INSERT INTO ${table(tableName)} (${sql.join(columns.map((c) => sql.identifier(c)), sql`, `)}) VALUES (${sql.join(
      columns.map((c) => sql`${values[c]}`),
      sql`, `,
    )})`,
  );
}

export function updateRow(db: AppDatabase, tableName: string, id: string, values: LocalRow): void {
  const assignments: SQL[] = Object.keys(values).map((c) => sql`${sql.identifier(c)} = ${values[c]}`);
  if (assignments.length === 0) return;
  db.run(sql`UPDATE ${table(tableName)} SET ${sql.join(assignments, sql`, `)} WHERE id = ${id}`);
}

export function deleteRowById(db: AppDatabase, tableName: string, id: string): void {
  db.run(sql`DELETE FROM ${table(tableName)} WHERE id = ${id}`);
}

export function deleteEntityTag(db: AppDatabase, key: EntityTagKey): void {
  db.run(
    sql`DELETE FROM entity_tags WHERE entity_type = ${key.entity_type} AND entity_id = ${key.entity_id} AND tag_id = ${key.tag_id}`,
  );
}

/** The local row (other than `id`) that holds the same natural key as `values`, if any. */
export function findNaturalKeyMatch(db: AppDatabase, tableName: string, values: LocalRow): LocalRow | undefined {
  const key = NATURAL_KEYS[tableName];
  if (!key) return undefined;
  const conditions = key.columns.map((column) =>
    key.caseInsensitive
      ? sql`lower(${sql.identifier(column)}) = lower(${values[column]})`
      : sql`${sql.identifier(column)} IS ${values[column]}`,
  );
  return db.get<LocalRow | undefined>(
    sql`SELECT * FROM ${table(tableName)} WHERE ${sql.join(conditions, sql` AND `)} AND id <> ${values.id} LIMIT 1`,
  );
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export interface OutboxEntry {
  id: number;
  entity_type: EntityType;
  entity_id: string;
  operation: 'upsert' | 'delete';
  attempts: number;
}

export function readOutbox(db: AppDatabase, limit: number): OutboxEntry[] {
  return db.all<OutboxEntry>(
    sql`SELECT id, entity_type, entity_id, operation, attempts FROM outbox ORDER BY id LIMIT ${limit}`,
  );
}

export function countOutbox(db: AppDatabase): number {
  return db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM outbox`).n;
}

export function hasPendingChange(db: AppDatabase, entityType: EntityType, entityId: string): boolean {
  const row = db.get<{ n: number }>(
    sql`SELECT COUNT(*) AS n FROM outbox WHERE entity_type = ${entityType} AND entity_id = ${entityId}`,
  );
  return row.n > 0;
}

export function deleteOutboxEntries(db: AppDatabase, ids: readonly number[]): void {
  if (ids.length === 0) return;
  db.run(sql`DELETE FROM outbox WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
}

export function deletePendingChanges(db: AppDatabase, entityType: EntityType, entityId: string): void {
  db.run(sql`DELETE FROM outbox WHERE entity_type = ${entityType} AND entity_id = ${entityId}`);
}

/** Records a failed attempt; `code` is a short machine code, never server text or user content. */
export function markOutboxFailure(db: AppDatabase, ids: readonly number[], code: string): void {
  if (ids.length === 0) return;
  db.run(
    sql`UPDATE outbox SET attempts = attempts + 1, last_error = ${code.slice(0, 120)} WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  );
}

export function enqueue(db: AppDatabase, entityType: EntityType, entityId: string): void {
  db.run(sql`INSERT INTO outbox (entity_type, entity_id, operation, created_at) VALUES (${entityType}, ${entityId}, 'upsert', ${nowIso()})`);
}

// ---------------------------------------------------------------------------
// sync_state (key/value)
// ---------------------------------------------------------------------------

export const stateKeys = {
  owner: 'sync:owner',
  cursor: (tableName: string) => `pull:${tableName}`,
  base: (entityType: EntityType, entityId: string) => `base:${entityType}:${entityId}`,
  retry: (entityType: EntityType, entityId: string) => `retry:${entityType}:${entityId}`,
  deferred: (tableName: string, rowKey: string) => `deferred:${tableName}:${rowKey}`,
};

export function getState(db: AppDatabase, key: string): string | null {
  return db.get<{ value: string } | undefined>(sql`SELECT value FROM sync_state WHERE key = ${key}`)?.value ?? null;
}

export function setState(db: AppDatabase, key: string, value: string): void {
  db.run(
    sql`INSERT INTO sync_state (key, value, updated_at) VALUES (${key}, ${value}, ${nowIso()})
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
}

export function deleteState(db: AppDatabase, key: string): void {
  db.run(sql`DELETE FROM sync_state WHERE key = ${key}`);
}

export function listStateByPrefix(db: AppDatabase, prefix: string): { key: string; value: string }[] {
  return db.all<{ key: string; value: string }>(
    sql`SELECT key, value FROM sync_state WHERE substr(key, 1, ${prefix.length}) = ${prefix} ORDER BY key`,
  );
}

export function deleteStateByPrefix(db: AppDatabase, prefix: string): void {
  db.run(sql`DELETE FROM sync_state WHERE substr(key, 1, ${prefix.length}) = ${prefix}`);
}

export function getBaseVersion(db: AppDatabase, entityType: EntityType, entityId: string): number | null {
  const raw = getState(db, stateKeys.base(entityType, entityId));
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function setBaseVersion(db: AppDatabase, entityType: EntityType, entityId: string, version: number): void {
  setState(db, stateKeys.base(entityType, entityId), String(version));
}

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------

export function recordConflict(db: AppDatabase, entityType: EntityType, entityId: string, local: LocalRow, remote: LocalRow): void {
  db.run(
    sql`INSERT INTO sync_conflicts (id, entity_type, entity_id, local_json, remote_json, created_at)
        VALUES (${newId()}, ${entityType}, ${entityId}, ${JSON.stringify(local)}, ${JSON.stringify(remote)}, ${nowIso()})`,
  );
}

export function countOpenConflicts(db: AppDatabase): number {
  return db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM sync_conflicts WHERE resolved_at IS NULL`).n;
}
