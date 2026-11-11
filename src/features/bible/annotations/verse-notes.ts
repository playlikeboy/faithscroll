import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { verseNotes } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

export type VerseNoteRow = typeof verseNotes.$inferSelect;

export interface NewVerseNote {
  startVerseId: number;
  endVerseId: number;
  content?: string;
}

export function createVerseNote(db: AppDatabase, { startVerseId, endVerseId, content = '' }: NewVerseNote): string {
  const [start, end] = startVerseId <= endVerseId ? [startVerseId, endVerseId] : [endVerseId, startVerseId];
  const id = newId();
  db.transaction((tx) => {
    tx.insert(verseNotes).values({ id, startVerseId: start, endVerseId: end, content }).run();
    enqueueChange(tx, 'verse_note', id, 'upsert');
  });
  return id;
}

/** The live note with this id, or undefined when missing/deleted. */
export function getVerseNote(db: AppDatabase, id: string): VerseNoteRow | undefined {
  return db
    .select()
    .from(verseNotes)
    .where(and(eq(verseNotes.id, id), isNull(verseNotes.deletedAt)))
    .get();
}

/** Save new note content. No-op when unchanged. Throws when the note was deleted. */
export function updateVerseNote(db: AppDatabase, id: string, content: string): void {
  db.transaction((tx) => {
    const current = getVerseNote(tx, id);
    if (!current) throw new Error('This note no longer exists.');
    if (current.content === content) return;
    tx.update(verseNotes)
      .set({ content, ...touch(verseNotes.version) })
      .where(eq(verseNotes.id, id))
      .run();
    enqueueChange(tx, 'verse_note', id, 'upsert');
  });
}

/** Soft-delete a note. Unknown or already-deleted ids are ignored. */
export function deleteVerseNote(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    if (!getVerseNote(tx, id)) return;
    tx.update(verseNotes).set(tombstone(verseNotes.version)).where(eq(verseNotes.id, id)).run();
    enqueueChange(tx, 'verse_note', id, 'delete');
  });
}

/** Live notes overlapping [startVerseId, endVerseId], most recently edited first. Returns a query. */
export function listNotesOverlapping(db: AppDatabase, startVerseId: number, endVerseId: number) {
  return db
    .select()
    .from(verseNotes)
    .where(
      and(
        lte(verseNotes.startVerseId, endVerseId),
        gte(verseNotes.endVerseId, startVerseId),
        isNull(verseNotes.deletedAt),
      ),
    )
    .orderBy(desc(verseNotes.updatedAt));
}
