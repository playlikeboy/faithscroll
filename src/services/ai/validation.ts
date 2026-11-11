/**
 * Post-validation of AI output on device (PRD §7, §17 "fabricated-reference checks").
 *
 * - Every Scripture reference a model returns must parse AND exist in the local Bible;
 *   anything else is dropped (and counted so the UI can say so).
 * - Timestamps are clamped to the length of the recording they point into.
 */
import { formatReference, parseReference } from '@/features/bible/reference';
import { getVerses } from '@/features/bible/repository';
import type { VerseRange } from '@/features/bible/types';
import { rangeToIds } from '@/features/bible/verse-id';
import { logger } from '@/lib/logger';

export interface ValidatedReference {
  /** Canonical display text, e.g. "Romans 8:28". */
  reference: string;
  range: VerseRange;
  startVerseId: number;
  endVerseId: number;
}

export type ReferenceChecker = (text: string) => Promise<ValidatedReference | null>;

/** Parse a reference and confirm its first and last verse exist in the bundled Bible. */
export async function checkScriptureReference(text: string): Promise<ValidatedReference | null> {
  const range = parseReference(text.trim());
  if (!range) return null;
  const { startVerseId, endVerseId } = rangeToIds(range);
  if (endVerseId < startVerseId) return null;
  try {
    const verses = await getVerses(range);
    const first = verses[0];
    const last = verses[verses.length - 1];
    if (!first || !last || first.id !== startVerseId || last.id !== endVerseId) return null;
  } catch (error) {
    logger.warn('Bible lookup failed while validating an AI reference', { error: String(error) });
    return null;
  }
  return { reference: formatReference(range) || text.trim(), range, startVerseId, endVerseId };
}

/** A checker that memoises lookups for the lifetime of one validation pass. */
export function createReferenceChecker(check: ReferenceChecker = checkScriptureReference): ReferenceChecker {
  const cache = new Map<string, Promise<ValidatedReference | null>>();
  return (text: string) => {
    const key = text.trim().toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;
    const pending = check(text);
    cache.set(key, pending);
    return pending;
  };
}

export interface FilteredReferences<T> {
  items: T[];
  /** How many items were removed because their reference could not be verified. */
  dropped: number;
}

/** Keep only items whose reference verifies; `apply` returns the item with canonical reference data. */
export async function filterValidReferences<T>(
  items: readonly T[],
  getText: (item: T) => string,
  apply: (item: T, reference: ValidatedReference) => T,
  checker: ReferenceChecker = createReferenceChecker(),
): Promise<FilteredReferences<T>> {
  const results = await Promise.all(items.map((item) => checker(getText(item))));
  const kept: T[] = [];
  results.forEach((reference, index) => {
    if (reference) kept.push(apply(items[index], reference));
  });
  return { items: kept, dropped: items.length - kept.length };
}

/**
 * Clamp a timestamp (seconds) into [0, durationSec].
 * Returns null when there is no recording to point into or the value is unusable.
 */
export function clampSeconds(value: number | null | undefined, durationSec: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (!durationSec || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  return Math.min(durationSec, Math.max(0, value));
}
