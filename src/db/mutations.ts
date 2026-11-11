import { sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

import { nowIso } from '@/lib/time';

import { outbox, type EntityType } from './schema';
import type { AppDatabase } from './types';

/**
 * Record a local change so the sync engine can push it later.
 * Call this in the same transaction as the write it describes.
 */
export function enqueueChange(
  db: AppDatabase,
  entityType: EntityType,
  entityId: string,
  operation: 'upsert' | 'delete' = 'upsert',
): void {
  db.insert(outbox).values({ entityType, entityId, operation }).run();
}

/** Columns to set on every edit of a syncable row: new `updated_at` and `version + 1`. */
export function touch(versionColumn: SQLiteColumn): { updatedAt: string; version: SQL } {
  return { updatedAt: nowIso(), version: sql`${versionColumn} + 1` };
}

/** Columns to set when soft-deleting a syncable row (tombstone kept for sync). */
export function tombstone(versionColumn: SQLiteColumn): { deletedAt: string; updatedAt: string; version: SQL } {
  const now = nowIso();
  return { deletedAt: now, updatedAt: now, version: sql`${versionColumn} + 1` };
}
