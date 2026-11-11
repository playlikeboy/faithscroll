import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { savedVerses } from '@/db/schema';

import type { HighlightColorValue } from '../annotations/highlights';
import { listHighlightsInRange } from '../annotations/highlights';
import type { SavedVerseRow } from '../annotations/saved-verses';
import type { VerseNoteRow } from '../annotations/verse-notes';
import { listNotesOverlapping } from '../annotations/verse-notes';

export interface RangeAnnotations {
  /** verse id → colour for highlighted verses inside the range. */
  highlights: ReadonlyMap<number, HighlightColorValue>;
  /** The live bookmark for exactly this range, if saved. */
  savedVerse: SavedVerseRow | undefined;
  notes: readonly VerseNoteRow[];
  isLoading: boolean;
  error: Error | undefined;
}

/** Live annotations for a verse range (verse action sheet, study screen). */
export function useRangeAnnotations(startVerseId: number, endVerseId: number): RangeAnnotations {
  const deps = [startVerseId, endVerseId];
  const highlights = useLiveQuery(listHighlightsInRange(db, startVerseId, endVerseId), deps);
  const notes = useLiveQuery(listNotesOverlapping(db, startVerseId, endVerseId), deps);
  const saved = useLiveQuery(
    db
      .select()
      .from(savedVerses)
      .where(
        and(
          eq(savedVerses.startVerseId, startVerseId),
          eq(savedVerses.endVerseId, endVerseId),
          isNull(savedVerses.deletedAt),
        ),
      ),
    deps,
  );

  const highlightMap = useMemo(
    () => new Map(highlights.data.map((row) => [row.verseId, row.color] as const)),
    [highlights.data],
  );

  return {
    highlights: highlightMap,
    savedVerse: saved.data[0],
    notes: notes.data,
    isLoading: highlights.updatedAt === undefined || saved.updatedAt === undefined,
    error: highlights.error ?? notes.error ?? saved.error,
  };
}
