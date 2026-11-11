import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';

import { listHighlightsInRange } from '../annotations/highlights';
import { listSavedVersesOverlapping } from '../annotations/saved-verses';
import { listNotesOverlapping } from '../annotations/verse-notes';
import { chapterBounds, deriveChapterMarkers, type ChapterMarkers } from '../reader/markers';

export interface ChapterAnnotations {
  markers: ChapterMarkers;
  error: Error | undefined;
}

/** Live highlights, notes and bookmarks for one chapter. */
export function useChapterAnnotations(bookId: number, chapter: number): ChapterAnnotations {
  const { start, end } = chapterBounds(bookId, chapter);
  const deps = [start, end];
  const highlights = useLiveQuery(listHighlightsInRange(db, start, end), deps);
  const notes = useLiveQuery(listNotesOverlapping(db, start, end), deps);
  const saved = useLiveQuery(listSavedVersesOverlapping(db, start, end), deps);

  const markers = useMemo(
    () => deriveChapterMarkers(start, highlights.data, notes.data, saved.data),
    [start, highlights.data, notes.data, saved.data],
  );

  return { markers, error: highlights.error ?? notes.error ?? saved.error };
}
