/**
 * A sermon can have several recording parts (`sermon_recordings` ordered by `started_at`).
 * Each part is transcribed separately; this merges the per-part results onto one sermon timeline,
 * where a part's offset is the sum of the earlier parts' `duration_ms`.
 */
import type { TranscriptPartResult } from '@/services/ai/contracts';

export interface RecordingPart {
  id: string;
  durationMs: number;
}

export interface MergedSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface MergedTranscript {
  text: string;
  language: string | null;
  /** True when any part's timestamps were estimated rather than reported by the provider. */
  approximate: boolean;
  segments: MergedSegment[];
  /** Recording ids that had no result. */
  missingParts: string[];
}

/** Map of recording id → offset (ms) on the sermon timeline. `recordings` must be in play order. */
export function partOffsets(recordings: readonly RecordingPart[]): Map<string, number> {
  const offsets = new Map<string, number>();
  let offset = 0;
  for (const recording of recordings) {
    offsets.set(recording.id, offset);
    offset += Math.max(0, recording.durationMs);
  }
  return offsets;
}

function toMs(seconds: number): number {
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
}

function partSegments(part: TranscriptPartResult, recording: RecordingPart, offsetMs: number): MergedSegment[] {
  const limit = recording.durationMs > 0 ? recording.durationMs : Number.POSITIVE_INFINITY;
  const clamp = (ms: number) => Math.min(limit, Math.max(0, ms));

  const source =
    part.segments.length > 0
      ? part.segments
      : [{ start: 0, end: recording.durationMs / 1000, text: part.text }];

  return source
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text.length > 0)
    .map((segment) => {
      const start = clamp(toMs(segment.start));
      const end = Math.max(start, clamp(toMs(segment.end)));
      return { startMs: offsetMs + start, endMs: offsetMs + end, text: segment.text };
    });
}

export function mergeTranscriptParts(
  parts: readonly TranscriptPartResult[],
  recordings: readonly RecordingPart[],
): MergedTranscript {
  const offsets = partOffsets(recordings);
  const byRecording = new Map(parts.map((part) => [part.recordingId, part]));

  const segments: MergedSegment[] = [];
  const texts: string[] = [];
  const missingParts: string[] = [];
  let language: string | null = null;
  let approximate = false;

  for (const recording of recordings) {
    const part = byRecording.get(recording.id);
    if (!part) {
      missingParts.push(recording.id);
      continue;
    }
    const merged = partSegments(part, recording, offsets.get(recording.id) ?? 0);
    segments.push(...merged);
    const partText = part.text.trim() || merged.map((segment) => segment.text).join(' ');
    if (partText) texts.push(partText);
    language = language ?? part.language;
    approximate = approximate || part.approximate;
  }

  return { text: texts.join('\n\n'), language, approximate, segments, missingParts };
}
