/** Verse range selection in the reader: long-press sets an anchor, the next tap closes the range. */
export interface VersePressResult {
  start: number;
  end: number;
}

/** Range opened by tapping `verseId` while `anchor` (or nothing) is selected. */
export function resolveVersePress(anchor: number | null, verseId: number): VersePressResult {
  if (anchor === null) return { start: verseId, end: verseId };
  return { start: Math.min(anchor, verseId), end: Math.max(anchor, verseId) };
}

const CHAPTER_FACTOR = 1_000;

/**
 * Verse ids of a range inside one chapter (ids are contiguous there). Returns null for
 * ranges that cross chapters, where the real verse list must come from the Bible data.
 */
export function contiguousVerseIds(startVerseId: number, endVerseId: number): number[] | null {
  if (Math.floor(startVerseId / CHAPTER_FACTOR) !== Math.floor(endVerseId / CHAPTER_FACTOR)) return null;
  if (endVerseId < startVerseId) return null;
  return Array.from({ length: endVerseId - startVerseId + 1 }, (_, index) => startVerseId + index);
}
