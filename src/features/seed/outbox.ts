/**
 * Sample rows must never upload. Repositories always enqueue their writes, so the seeding and
 * removal code drops the outbox entries it produced (identified by outbox id watermark).
 */
import { and, gt, inArray, max } from 'drizzle-orm';

import { outbox } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getBaseVersion } from '@/features/sync/local-store';

/** Highest outbox id right now (0 when empty). Take it before writing. */
export function outboxWatermark(db: AppDatabase): number {
  return db.select({ value: max(outbox.id) }).from(outbox).get()?.value ?? 0;
}

/** Drop every outbox entry added after the watermark. */
export function dropOutboxAfter(db: AppDatabase, watermark: number): void {
  db.delete(outbox).where(gt(outbox.id, watermark)).run();
}

/**
 * Drop entries added after the watermark for rows the server has never seen (no sync base
 * version). Entries for rows that did reach the server are kept so their deletion syncs too.
 */
export function dropUnsyncedOutboxAfter(db: AppDatabase, watermark: number): void {
  const entries = db
    .select({ id: outbox.id, entityType: outbox.entityType, entityId: outbox.entityId })
    .from(outbox)
    .where(gt(outbox.id, watermark))
    .all();
  const unsynced = entries.filter((entry) => getBaseVersion(db, entry.entityType, entry.entityId) === null).map((entry) => entry.id);
  if (unsynced.length === 0) return;
  db.delete(outbox).where(and(gt(outbox.id, watermark), inArray(outbox.id, unsynced))).run();
}
