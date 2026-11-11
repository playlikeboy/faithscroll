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

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Yesterday" or a short date ("9 Nov") for when a chapter was last read. */
export function formatReadAt(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Human reference for a range ("Romans 8:28–30"). Uses the shared `formatReference`
 * and falls back to a local format if it yields nothing.
 */
export function rangeLabel(range: VerseRange): string {
  const formatted = formatReference(range);
  return formatted.trim() ? formatted : fallbackReference(range);
}
