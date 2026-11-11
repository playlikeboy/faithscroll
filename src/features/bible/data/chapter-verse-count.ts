import type { VerseRef } from '../types';
import { OMITTED_VERSE_IDS, VERSE_COUNTS } from './verse-counts';

const OMITTED = new Set(OMITTED_VERSE_IDS);

/**
 * Number of verses in a chapter of the bundled translation (0 when the book or chapter doesn't exist).
 * This is the highest verse number; a few verse numbers inside it may be omitted (see `isOmittedVerse`).
 * Pure lookup — no database access — so it is safe in parsers and render paths.
 */
export function chapterVerseCount(bookId: number, chapter: number): number {
  if (!Number.isInteger(bookId) || !Number.isInteger(chapter)) return 0;
  return VERSE_COUNTS[bookId - 1]?.[chapter - 1] ?? 0;
}

/** True for verse numbers the translation leaves out (e.g. Acts 8:37 in the WEB). */
export function isOmittedVerse({ bookId, chapter, verse }: VerseRef): boolean {
  return OMITTED.has(bookId * 1_000_000 + chapter * 1_000 + verse);
}
