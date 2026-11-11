import type { VerseRange, VerseRef } from './types';

const BOOK_FACTOR = 1_000_000;
const CHAPTER_FACTOR = 1_000;

/** Stable integer id for a verse: book * 1_000_000 + chapter * 1_000 + verse. */
export function toVerseId({ bookId, chapter, verse }: VerseRef): number {
  return bookId * BOOK_FACTOR + chapter * CHAPTER_FACTOR + verse;
}

export function fromVerseId(id: number): VerseRef {
  return {
    bookId: Math.floor(id / BOOK_FACTOR),
    chapter: Math.floor((id % BOOK_FACTOR) / CHAPTER_FACTOR),
    verse: id % CHAPTER_FACTOR,
  };
}

export function rangeToIds(range: VerseRange): { startVerseId: number; endVerseId: number } {
  return { startVerseId: toVerseId(range.start), endVerseId: toVerseId(range.end) };
}

export function idsToRange(startVerseId: number, endVerseId: number = startVerseId): VerseRange {
  return { start: fromVerseId(startVerseId), end: fromVerseId(endVerseId) };
}

export function singleVerseRange(ref: VerseRef): VerseRange {
  return { start: ref, end: ref };
}

export function rangeContains(range: VerseRange, verseId: number): boolean {
  return verseId >= toVerseId(range.start) && verseId <= toVerseId(range.end);
}
