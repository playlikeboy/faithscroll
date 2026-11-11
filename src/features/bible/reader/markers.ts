import type { HighlightColorValue } from '../annotations/highlights';
import { toVerseId } from '../verse-id';

/** Inclusive verse-id bounds that cover every verse of a chapter. */
export function chapterBounds(bookId: number, chapter: number): { start: number; end: number } {
  return { start: toVerseId({ bookId, chapter, verse: 0 }), end: toVerseId({ bookId, chapter, verse: 999 }) };
}

interface RangeLike {
  startVerseId: number;
  endVerseId: number;
}

export interface ChapterMarkers {
  /** verse id → highlight colour */
  highlights: ReadonlyMap<number, HighlightColorValue>;
  /** Verse ids that show a note indicator (first verse of each note inside the chapter). */
  noteVerseIds: ReadonlySet<number>;
  /** Verse ids that show a bookmark indicator (first verse of each saved range inside the chapter). */
  bookmarkVerseIds: ReadonlySet<number>;
}

function firstVerseInChapter(range: RangeLike, chapterStart: number): number {
  // Verse 0 is not a real verse, so a range starting in an earlier chapter marks verse 1.
  return Math.max(range.startVerseId, chapterStart + 1);
}

export function deriveChapterMarkers(
  chapterStart: number,
  highlights: readonly { verseId: number; color: HighlightColorValue }[],
  notes: readonly RangeLike[],
  saved: readonly RangeLike[],
): ChapterMarkers {
  return {
    highlights: new Map(highlights.map((row) => [row.verseId, row.color])),
    noteVerseIds: new Set(notes.map((note) => firstVerseInChapter(note, chapterStart))),
    bookmarkVerseIds: new Set(saved.map((row) => firstVerseInChapter(row, chapterStart))),
  };
}

/** The colour shared by every verse in `verseIds`, or null when mixed/unhighlighted. */
export function sharedHighlightColor(
  verseIds: readonly number[],
  highlights: ReadonlyMap<number, HighlightColorValue>,
): HighlightColorValue | null {
  if (verseIds.length === 0) return null;
  const first = highlights.get(verseIds[0]);
  if (!first) return null;
  return verseIds.every((id) => highlights.get(id) === first) ? first : null;
}
