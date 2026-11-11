/**
 * Scripture references spoken in a transcript (PRD §6.3F "Scripture references extracted").
 * Uses the Bible feature's `findReferences` on each segment, keeps only references that exist in
 * the local Bible, and records the segment start as the position in the recording.
 */
import { findReferences } from '@/features/bible/reference';
import { createReferenceChecker, type ReferenceChecker } from '@/services/ai/validation';
import { logger } from '@/lib/logger';

import type { DetectedReference } from './repository';

export interface SegmentText {
  startMs: number;
  text: string;
}

export async function detectSegmentReferences(
  segments: readonly SegmentText[],
  checker: ReferenceChecker = createReferenceChecker(),
): Promise<DetectedReference[]> {
  const candidates = segments.flatMap((segment) => {
    try {
      return findReferences(segment.text).map((found) => ({ text: found.text, positionMs: segment.startMs }));
    } catch (error) {
      logger.warn('Reference detection failed for a segment', { message: error instanceof Error ? error.message : 'unknown' });
      return [];
    }
  });

  const checked = await Promise.all(candidates.map(async (candidate) => ({ candidate, verified: await checker(candidate.text) })));

  const seen = new Set<string>();
  const detected: DetectedReference[] = [];
  for (const { candidate, verified } of checked) {
    if (!verified) continue;
    const key = `${verified.startVerseId}-${verified.endVerseId}@${candidate.positionMs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    detected.push({
      startVerseId: verified.startVerseId,
      endVerseId: verified.endVerseId,
      referenceText: verified.reference,
      positionMs: candidate.positionMs,
    });
  }
  return detected;
}

export interface ReferenceSummary {
  referenceText: string;
  startVerseId: number;
  endVerseId: number;
  /** Positions (ms) where the passage was mentioned, ascending. */
  positionsMs: number[];
}

/** One chip per passage, with every moment it was mentioned. */
export function summarizeReferences(
  rows: readonly { referenceText: string; startVerseId: number; endVerseId: number; positionMs: number | null }[],
): ReferenceSummary[] {
  const byRange = new Map<string, ReferenceSummary>();
  for (const row of rows) {
    const key = `${row.startVerseId}-${row.endVerseId}`;
    const existing = byRange.get(key);
    const positions = row.positionMs === null ? [] : [row.positionMs];
    byRange.set(
      key,
      existing
        ? { ...existing, positionsMs: [...existing.positionsMs, ...positions].sort((a, b) => a - b) }
        : { referenceText: row.referenceText, startVerseId: row.startVerseId, endVerseId: row.endVerseId, positionsMs: positions },
    );
  }
  return [...byRange.values()].sort((a, b) => (a.positionsMs[0] ?? Infinity) - (b.positionsMs[0] ?? Infinity));
}
