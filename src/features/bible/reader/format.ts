import { getBook } from '../books';
import { formatReference } from '../reference';
import type { VerseRange, VerseRef } from '../types';

/** Book name for a chapter heading: "Psalm 23" reads better than "Psalms 23". */
function chapterBookName(bookId: number): string {
  const book = getBook(bookId);
  if (!book) return 'Unknown book';
  return book.code === 'PSA' ? 'Psalm' : book.name;
}

/** "John 3", "Psalm 23". */
export function chapterTitle(bookId: number, chapter: number): string {
  return `${chapterBookName(bookId)} ${chapter}`;
}

function sameChapter(a: VerseRef, b: VerseRef): boolean {
  return a.bookId === b.bookId && a.chapter === b.chapter;
}

function fallbackReference({ start, end }: VerseRange): string {
  const head = `${chapterBookName(start.bookId)} ${start.chapter}:${start.verse}`;
  if (sameChapter(start, end)) return end.verse === start.verse ? head : `${head}–${end.verse}`;
  if (start.bookId === end.bookId) return `${head}–${end.chapter}:${end.verse}`;
  return `${head}–${chapterBookName(end.bookId)} ${end.chapter}:${end.verse}`;
}

/**
 * Human reference for a range ("Romans 8:28–30"). Uses the shared `formatReference`
 * and falls back to a local format if it yields nothing.
 */
export function rangeLabel(range: VerseRange): string {
  const formatted = formatReference(range);
  return formatted.trim() ? formatted : fallbackReference(range);
}
