import { getBook } from '@/features/bible/books';
import { formatReference } from '@/features/bible/reference';
import type { Verse, VerseRange } from '@/features/bible/types';
import { rangeToIds } from '@/features/bible/verse-id';

/** Minimal "Book c:v–v" label used only if the shared formatter returns nothing. */
function fallbackLabel({ start, end }: VerseRange): string {
  const book = getBook(start.bookId)?.name ?? 'Passage';
  const head = `${book} ${start.chapter}:${start.verse}`;
  if (start.bookId !== end.bookId) return `${head}–${getBook(end.bookId)?.name ?? ''} ${end.chapter}:${end.verse}`;
  if (start.chapter !== end.chapter) return `${head}–${end.chapter}:${end.verse}`;
  if (start.verse !== end.verse) return `${head}–${end.verse}`;
  return head;
}

/** Display label for a passage, e.g. "Romans 8:28". */
export function passageLabel(range: VerseRange): string {
  return formatReference(range) || fallbackLabel(range);
}

/** "Romans 8" — the chapter that contains the start of a passage. */
export function chapterLabel(range: VerseRange): string {
  const book = getBook(range.start.bookId)?.name ?? 'Chapter';
  return `${book} ${range.start.chapter}`;
}

export function joinVerseText(verses: readonly Verse[]): string {
  return verses
    .map((verse) => verse.text.trim())
    .filter(Boolean)
    .join(' ');
}

export function rangeKey(range: VerseRange): string {
  const { startVerseId, endVerseId } = rangeToIds(range);
  return `${startVerseId}-${endVerseId}`;
}
