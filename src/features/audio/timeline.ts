/**
 * The sermon timeline: a sermon's playable recording parts played back to back.
 * A part's offset is the sum of the earlier parts' durations (same rule as transcript merging in
 * `src/features/transcription/merge.ts`), so `[mm:ss]` note tokens, bookmarks and transcript
 * timestamps all point at the same moment.
 */

export interface TimelineInputPart {
  id: string;
  durationMs: number;
  /** Playable file URI; parts without one are left out. */
  uri: string | null;
}

export interface TimelinePart {
  id: string;
  durationMs: number;
  uri: string;
  offsetMs: number;
}

export interface Timeline {
  parts: TimelinePart[];
  totalMs: number;
}

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const SKIP_MS = 15_000;

export function buildTimeline(parts: readonly TimelineInputPart[]): Timeline {
  let offsetMs = 0;
  const playable: TimelinePart[] = [];
  parts.forEach((part) => {
    if (!part.uri) return;
    const durationMs = Math.max(0, part.durationMs);
    playable.push({ id: part.id, durationMs, uri: part.uri, offsetMs });
    offsetMs += durationMs;
  });
  return { parts: playable, totalMs: offsetMs };
}

export function clampPosition(positionMs: number, totalMs: number): number {
  return Math.min(Math.max(0, positionMs), Math.max(0, totalMs));
}

/** Which part holds a sermon position, and where inside it. */
export function locate(timeline: Timeline, positionMs: number): { index: number; localMs: number } | null {
  const { parts } = timeline;
  if (parts.length === 0) return null;
  const position = clampPosition(positionMs, timeline.totalMs);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (position >= parts[index].offsetMs) {
      return { index, localMs: Math.min(position - parts[index].offsetMs, parts[index].durationMs) };
    }
  }
  return { index: 0, localMs: 0 };
}

/**
 * Position of a moment inside a part on the sermon timeline. A null recording id means the
 * position is already on the sermon timeline. Unknown parts return null.
 */
export function toGlobalMs(timeline: Timeline, recordingId: string | null, localMs: number): number | null {
  if (recordingId === null) return localMs;
  const part = timeline.parts.find((candidate) => candidate.id === recordingId);
  return part ? part.offsetMs + localMs : null;
}

/** The next speed in the cycle (wraps to the slowest after 2×). */
export function nextRate(current: number): number {
  const index = PLAYBACK_RATES.findIndex((rate) => rate === current);
  if (index === -1) return 1;
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
}

export function formatRate(rate: number): string {
  return `${rate}×`;
}
