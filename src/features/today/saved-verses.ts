/**
 * Small saved-verse repository used by Today (Verse of the Day) and Discover.
 * Every write is paired with an outbox entry in the same transaction.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { enqueueChange, tombstone } from '@/db/mutations';
import { savedVerses } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

function assertValidRange(startVerseId: number, endVerseId: number): void {
  const valid =
    Number.isInteger(startVerseId) && Number.isInteger(endVerseId) && startVerseId > 0 && endVerseId >= startVerseId;
  if (!valid) throw new Error('Invalid verse range');
}

/** Live-queryable: the non-deleted saved row for exactly this range (0 or 1 rows). */
export function savedRangeQuery(db: AppDatabase, startVerseId: number, endVerseId: number) {
  return db
    .select({ id: savedVerses.id })
    .from(savedVerses)
    .where(
      and(
        eq(savedVerses.startVerseId, startVerseId),
        eq(savedVerses.endVerseId, endVerseId),
        isNull(savedVerses.deletedAt),
      ),
    )
    .limit(1);
}

/** Live-queryable: saved (non-deleted) rows starting at any of `startVerseIds`. */
export function savedRangesQuery(db: AppDatabase, startVerseIds: readonly number[]) {
  // -1 never matches; it keeps the IN list non-empty.
  return db
    .select({ id: savedVerses.id, startVerseId: savedVerses.startVerseId, endVerseId: savedVerses.endVerseId })
    .from(savedVerses)
    .where(and(isNull(savedVerses.deletedAt), inArray(savedVerses.startVerseId, [...startVerseIds, -1])));
}

/** Saves a range; returns the existing id when it's already saved (idempotent). */
export function saveVerseRange(db: AppDatabase, startVerseId: number, endVerseId: number): string {
  assertValidRange(startVerseId, endVerseId);
  return db.transaction((tx) => {
    const existing = savedRangeQuery(tx, startVerseId, endVerseId).get();
    if (existing) return existing.id;
    const id = newId();
    tx.insert(savedVerses).values({ id, startVerseId, endVerseId }).run();
    enqueueChange(tx, 'saved_verse', id, 'upsert');
    return id;
  });
}

/** Soft-deletes a saved verse (tombstone kept for sync). */
export function removeSavedVerse(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    tx.update(savedVerses).set(tombstone(savedVerses.version)).where(eq(savedVerses.id, id)).run();
    enqueueChange(tx, 'saved_verse', id, 'delete');
  });
}
