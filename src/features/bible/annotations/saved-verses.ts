import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { savedVerses } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

export type SavedVerseRow = typeof savedVerses.$inferSelect;

function ordered(startVerseId: number, endVerseId: number): [number, number] {
  return startVerseId <= endVerseId ? [startVerseId, endVerseId] : [endVerseId, startVerseId];
}

function findAnyExact(db: AppDatabase, startVerseId: number, endVerseId: number): SavedVerseRow | undefined {
  return db
    .select()
    .from(savedVerses)
    .where(and(eq(savedVerses.startVerseId, startVerseId), eq(savedVerses.endVerseId, endVerseId)))
    .orderBy(asc(savedVerses.deletedAt))
    .get();
}

/** The live saved row for exactly this range, if any. */
export function findSavedVerse(db: AppDatabase, startVerseId: number, endVerseId: number): SavedVerseRow | undefined {
  const [start, end] = ordered(startVerseId, endVerseId);
  return db
    .select()
    .from(savedVerses)
    .where(and(eq(savedVerses.startVerseId, start), eq(savedVerses.endVerseId, end), isNull(savedVerses.deletedAt)))
    .get();
}

/** Ensure the range is saved (idempotent; revives a tombstoned row). Returns the saved verse id. */
export function saveVerseRange(db: AppDatabase, startVerseId: number, endVerseId: number): string {
  const [start, end] = ordered(startVerseId, endVerseId);
  return db.transaction((tx) => {
    const existing = findAnyExact(tx, start, end);
    if (existing && existing.deletedAt === null) return existing.id;
    if (existing) {
      tx.update(savedVerses)
        .set({ deletedAt: null, ...touch(savedVerses.version) })
        .where(eq(savedVerses.id, existing.id))
        .run();
      enqueueChange(tx, 'saved_verse', existing.id, 'upsert');
      return existing.id;
    }
    const id = newId();
    tx.insert(savedVerses).values({ id, startVerseId: start, endVerseId: end }).run();
    enqueueChange(tx, 'saved_verse', id, 'upsert');
    return id;
  });
}

/** Soft-delete a saved verse by id. Unknown or already-deleted ids are ignored. */
export function removeSavedVerse(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    const row = tx
      .select({ id: savedVerses.id })
      .from(savedVerses)
      .where(and(eq(savedVerses.id, id), isNull(savedVerses.deletedAt)))
      .get();
    if (!row) return;
    tx.update(savedVerses).set(tombstone(savedVerses.version)).where(eq(savedVerses.id, id)).run();
    enqueueChange(tx, 'saved_verse', id, 'delete');
  });
}

/** Bookmark toggle for a range. */
export function toggleSavedVerse(
  db: AppDatabase,
  startVerseId: number,
  endVerseId: number,
): { id: string; saved: boolean } {
  return db.transaction((tx) => {
    const live = findSavedVerse(tx, startVerseId, endVerseId);
    if (live) {
      removeSavedVerse(tx, live.id);
      return { id: live.id, saved: false };
    }
    return { id: saveVerseRange(tx, startVerseId, endVerseId), saved: true };
  });
}

/** Live saved ranges that overlap [startVerseId, endVerseId]. Returns a query. */
export function listSavedVersesOverlapping(db: AppDatabase, startVerseId: number, endVerseId: number) {
  return db
    .select()
    .from(savedVerses)
    .where(
      and(
        lte(savedVerses.startVerseId, endVerseId),
        gte(savedVerses.endVerseId, startVerseId),
        isNull(savedVerses.deletedAt),
      ),
    )
    .orderBy(asc(savedVerses.startVerseId));
}
