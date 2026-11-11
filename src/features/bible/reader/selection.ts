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

export function isInSelection(anchor: number | null, verseId: number): boolean {
  return anchor !== null && anchor === verseId;
}
