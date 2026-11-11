import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { verseNotes } from '@/db/schema';

import type { VerseNoteRow } from '../annotations/verse-notes';

export interface VerseNoteState {
  note: VerseNoteRow | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

/** Live verse note by id (undefined once deleted). */
export function useVerseNote(id: string): VerseNoteState {
  const { data, updatedAt, error } = useLiveQuery(
    db
      .select()
      .from(verseNotes)
      .where(and(eq(verseNotes.id, id), isNull(verseNotes.deletedAt))),
    [id],
  );
  return { note: data[0], isLoading: updatedAt === undefined && !error, error };
}
