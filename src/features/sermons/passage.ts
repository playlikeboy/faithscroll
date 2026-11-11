import { getBook } from '@/features/bible/books';
import { formatReference } from '@/features/bible/reference';
import type { VerseRange } from '@/features/bible/types';
import { idsToRange, rangeToIds } from '@/features/bible/verse-id';

import type { PassageValue } from './types';

/** Local formatting used when the shared `formatReference` is unavailable (still a stub) or fails. */
export function fallbackReference({ start, end }: VerseRange): string {
  const startBook = getBook(start.bookId)?.name ?? 'Passage';
  const head = `${startBook} ${start.chapter}:${start.verse}`;
  if (start.bookId !== end.bookId) {
    return `${head} – ${getBook(end.bookId)?.name ?? ''} ${end.chapter}:${end.verse}`.trim();
  }
  if (start.chapter !== end.chapter) return `${head}–${end.chapter}:${end.verse}`;
  if (start.verse !== end.verse) return `${head}–${end.verse}`;
  return head;
}

export function referenceText(range: VerseRange): string {
  try {
    const formatted = formatReference(range);
    if (formatted) return formatted;
  } catch {
    // fall through to the local formatter
  }
  return fallbackReference(range);
}

/** Convert a picked range into the stored shape (display text + inclusive verse ids). */
export function passageFromRange(range: VerseRange): PassageValue {
  return { text: referenceText(range), ...rangeToIds(range) };
}

export function rangeFromPassage(passage: { startVerseId: number; endVerseId: number }): VerseRange {
  return idsToRange(passage.startVerseId, passage.endVerseId);
}

/** Reader route params for a passage: opens the chapter scrolled to the first verse. */
export function readerHref(startVerseId: number) {
  const { start } = idsToRange(startVerseId);
  return {
    pathname: '/bible/read/[bookId]/[chapter]' as const,
    params: { bookId: String(start.bookId), chapter: String(start.chapter), verse: String(start.verse) },
  };
}
