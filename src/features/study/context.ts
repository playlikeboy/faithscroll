import type { Verse } from '@/features/bible/types';

export const CONTEXT_RADIUS = 3;

export interface PassageContext {
  before: Verse[];
  after: Verse[];
}

/**
 * Verses immediately around a passage. `startChapter` is the chapter containing the first verse,
 * `endChapter` the chapter containing the last (the same array for single-chapter passages).
 */
export function surroundingContext(
  startChapter: readonly Verse[],
  endChapter: readonly Verse[],
  startVerseId: number,
  endVerseId: number,
  radius: number = CONTEXT_RADIUS,
): PassageContext {
  const startIndex = startChapter.findIndex((verse) => verse.id === startVerseId);
  const endIndex = endChapter.findIndex((verse) => verse.id === endVerseId);
  return {
    before: startIndex > 0 ? startChapter.slice(Math.max(0, startIndex - radius), startIndex) : [],
    after: endIndex >= 0 ? endChapter.slice(endIndex + 1, endIndex + 1 + radius) : [],
  };
}
