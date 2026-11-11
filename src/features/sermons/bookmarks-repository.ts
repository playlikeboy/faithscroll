/**
 * Timestamp bookmarks. `positionMs` is relative to the recording part (`recordingId`) it was captured in;
 * the player converts it to the sermon timeline with `src/features/audio/timeline.ts`.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { sermonBookmarks, sermonRecordings } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

import { cleanText } from './format';
import type { BookmarkRow, PassageValue } from './types';

export interface NewBookmark {
  sermonId: string;
  recordingId: string | null;
  positionMs: number;
  note?: string | null;
  reference?: PassageValue | null;
}

export interface BookmarkPatch {
  note?: string | null;
  reference?: PassageValue | null;
}

function referenceColumns(reference: PassageValue | null | undefined) {
  if (!reference) return { reference: null, startVerseId: null, endVerseId: null };
  return { reference: cleanText(reference.text), startVerseId: reference.startVerseId, endVerseId: reference.endVerseId };
}

export function getBookmark(db: AppDatabase, id: string): BookmarkRow | null {
  return db.select().from(sermonBookmarks).where(and(eq(sermonBookmarks.id, id), isNull(sermonBookmarks.deletedAt))).get() ?? null;
}

export function addBookmark(db: AppDatabase, input: NewBookmark): BookmarkRow {
  if (!Number.isFinite(input.positionMs) || input.positionMs < 0) throw new Error('Bookmark position must be zero or more');
  const id = newId();
  return db.transaction((tx) => {
    tx.insert(sermonBookmarks)
      .values({
        id,
        sermonId: input.sermonId,
        recordingId: input.recordingId,
        positionMs: Math.round(input.positionMs),
        note: cleanText(input.note),
        ...referenceColumns(input.reference),
      })
      .run();
    enqueueChange(tx, 'sermon_bookmark', id, 'upsert');
    const created = tx.select().from(sermonBookmarks).where(eq(sermonBookmarks.id, id)).get();
    if (!created) throw new Error('Bookmark could not be saved');
    return created;
  });
}

export function updateBookmark(db: AppDatabase, id: string, patch: BookmarkPatch): BookmarkRow | null {
  if (!getBookmark(db, id)) return null;
  const set = {
    ...(patch.note !== undefined && { note: cleanText(patch.note) }),
    ...(patch.reference !== undefined && referenceColumns(patch.reference)),
  };
  return db.transaction((tx) => {
    tx.update(sermonBookmarks)
      .set({ ...set, ...touch(sermonBookmarks.version) })
      .where(eq(sermonBookmarks.id, id))
      .run();
    enqueueChange(tx, 'sermon_bookmark', id, 'upsert');
    return tx.select().from(sermonBookmarks).where(eq(sermonBookmarks.id, id)).get() ?? null;
  });
}

export function deleteBookmark(db: AppDatabase, id: string): void {
  if (!getBookmark(db, id)) return;
  db.transaction((tx) => {
    tx.update(sermonBookmarks).set(tombstone(sermonBookmarks.version)).where(eq(sermonBookmarks.id, id)).run();
    enqueueChange(tx, 'sermon_bookmark', id, 'delete');
  });
}

/** A sermon's bookmarks in timeline order: by recording part, then position within the part. */
export function listBookmarks(db: AppDatabase, sermonId: string): BookmarkRow[] {
  return db
    .select({ bookmark: sermonBookmarks })
    .from(sermonBookmarks)
    .leftJoin(sermonRecordings, eq(sermonBookmarks.recordingId, sermonRecordings.id))
    .where(and(eq(sermonBookmarks.sermonId, sermonId), isNull(sermonBookmarks.deletedAt)))
    .orderBy(
      asc(sql`coalesce(${sermonRecordings.startedAt}, ${sermonRecordings.createdAt}, '')`),
      asc(sermonBookmarks.positionMs),
      asc(sermonBookmarks.createdAt),
    )
    .all()
    .map((row) => row.bookmark);
}
