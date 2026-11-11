import { getBook } from '@/features/bible/books';

import type { PlanReading } from './types';

function bookLabel(bookId: number, chapterCount: number): string {
  const book = getBook(bookId);
  if (!book) return 'Unknown book';
  // "Psalm 23" reads naturally for a single psalm; "Psalms 1–5" for several.
  return book.code === 'PSA' && chapterCount === 1 ? 'Psalm' : book.name;
}

/** "John 3", "Psalm 103:1–5", "Luke 17:11–19". */
export function formatPlanReading(reading: PlanReading): string {
  const base = `${bookLabel(reading.bookId, 1)} ${reading.chapter}`;
  if (reading.startVerse === undefined) return base;
  const end = reading.endVerse !== undefined && reading.endVerse !== reading.startVerse ? `–${reading.endVerse}` : '';
  return `${base}:${reading.startVerse}${end}`;
}

/** A display group: either a run of whole chapters in one book, or a single verse-range reading. */
type ReadingGroup = { kind: 'chapters'; bookId: number; from: number; to: number } | { kind: 'passage'; reading: PlanReading };

function groupReadings(readings: readonly PlanReading[]): ReadingGroup[] {
  return readings.reduce<ReadingGroup[]>((groups, reading) => {
    if (reading.startVerse !== undefined) return [...groups, { kind: 'passage', reading }];
    const last = groups[groups.length - 1];
    if (last?.kind === 'chapters' && last.bookId === reading.bookId && last.to + 1 === reading.chapter) {
      return [...groups.slice(0, -1), { ...last, to: reading.chapter }];
    }
    return [...groups, { kind: 'chapters', bookId: reading.bookId, from: reading.chapter, to: reading.chapter }];
  }, []);
}

function formatGroup(group: ReadingGroup): string {
  if (group.kind === 'passage') return formatPlanReading(group.reading);
  const count = group.to - group.from + 1;
  return `${bookLabel(group.bookId, count)} ${group.from}${count > 1 ? `–${group.to}` : ''}`;
}

/** Merge consecutive whole chapters of the same book: "Genesis 1–3", "Genesis 50, Exodus 1–2". */
export function formatDayReadings(readings: readonly PlanReading[]): string {
  return groupReadings(readings).map(formatGroup).join(', ');
}

/** Reader route for a reading; verse ranges scroll to their first verse. */
export function readingHref(reading: PlanReading): string {
  const base = `/bible/read/${reading.bookId}/${reading.chapter}`;
  return reading.startVerse === undefined ? base : `${base}?verse=${reading.startVerse}`;
}
