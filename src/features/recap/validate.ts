/**
 * Device-side checks applied to every recap the server returns, before it is saved:
 * Scripture references must exist in the local Bible, timestamps must fall inside the recording.
 */
import { clampSeconds, createReferenceChecker, filterValidReferences, type ReferenceChecker } from '@/services/ai/validation';

import type { SermonRecap } from './schema';

export interface RecapValidationOptions {
  /** Total length of all recording parts, in seconds; null when the recap came from notes only. */
  durationSec: number | null;
  checker?: ReferenceChecker;
}

export interface RecapValidationReport {
  droppedReferences: number;
  adjustedTimestamps: number;
}

function clampList(values: readonly number[], durationSec: number | null): { values: number[]; adjusted: number } {
  const clamped = values.map((value) => clampSeconds(value, durationSec));
  const kept = [...new Set(clamped.filter((value): value is number => value !== null))].sort((a, b) => a - b);
  const adjusted = clamped.filter((value, index) => value !== values[index]).length;
  return { values: kept, adjusted };
}

export async function validateRecap(
  recap: SermonRecap,
  { durationSec, checker = createReferenceChecker() }: RecapValidationOptions,
): Promise<{ recap: SermonRecap; report: RecapValidationReport }> {
  let adjusted = 0;
  const clampOne = (value: number | null): number | null => {
    const next = clampSeconds(value, durationSec);
    if (value !== null && next !== value) adjusted += 1;
    return next;
  };

  const references = await filterValidReferences(
    recap.scripture_references,
    (item) => item.reference,
    (item, ref) => ({
      ...item,
      reference: ref.reference,
      timestamp: clampOne(item.timestamp),
      startVerseId: ref.startVerseId,
      endVerseId: ref.endVerseId,
    }),
    checker,
  );

  const mainPoints = recap.main_points.map((point) => {
    const result = clampList(point.timestamps, durationSec);
    adjusted += durationSec ? result.adjusted : 0;
    return { ...point, timestamps: result.values };
  });

  const moments = recap.important_moments.map((moment) => ({ ...moment, timestamp: clampOne(moment.timestamp) }));

  return {
    recap: { ...recap, main_points: mainPoints, scripture_references: references.items, important_moments: moments },
    report: { droppedReferences: references.dropped, adjustedTimestamps: durationSec ? adjusted : 0 },
  };
}
