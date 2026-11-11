/**
 * Human-readable text for a verse-id range. Prefers the shared `formatReference`
 * (bible-data) and falls back to a local formatter so links never show an empty label.
 */
import { getBook } from '@/features/bible/books';
import { formatReference } from '@/features/bible/reference';
import type { VerseRef } from '@/features/bible/types';
import { idsToRange } from '@/features/bible/verse-id';
import { logger } from '@/lib/logger';

const FALLBACK_LABEL = 'Passage';

function fallbackFormat(start: VerseRef, end: VerseRef): string {
  const startBook = getBook(start.bookId);
  const endBook = getBook(end.bookId);
  if (!startBook || !endBook) return FALLBACK_LABEL;

  const head = `${startBook.name} ${start.chapter}:${start.verse}`;
  if (start.bookId !== end.bookId) return `${head} – ${endBook.name} ${end.chapter}:${end.verse}`;
  if (start.chapter !== end.chapter) return `${head}–${end.chapter}:${end.verse}`;
  if (start.verse !== end.verse) return `${head}–${end.verse}`;
  return head;
}

export function describeVerseRange(startVerseId: number, endVerseId: number = startVerseId): string {
  const range = idsToRange(startVerseId, endVerseId);
  try {
    const formatted = formatReference(range);
    if (formatted) return formatted;
  } catch (error) {
    logger.warn('formatReference failed; using fallback', { error: String(error) });
  }
  return fallbackFormat(range.start, range.end);
}
