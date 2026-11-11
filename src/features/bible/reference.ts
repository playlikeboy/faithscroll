/**
 * CONTRACT STUB — owned by the bible-data agent.
 * Parse, format and detect Bible references. Pure functions, no database access.
 */
import type { FoundReference, VerseRange } from './types';

/**
 * Parse a single reference such as "Romans 8:28", "Rom 8:28-30", "1 Cor 13:4-7",
 * "John 3" (whole chapter), "Ps 23:1-24:2". Returns null when not a valid reference.
 */
export function parseReference(_input: string): VerseRange | null {
  return null;
}

/** "Romans 8:28", "Matthew 18:21–35", "John 3"; `short` uses abbreviations ("Rom 8:28"). */
export function formatReference(_range: VerseRange, _options?: { short?: boolean }): string {
  return '';
}

/** Find every Bible reference mentioned in free text (notes, transcripts). */
export function findReferences(_text: string): FoundReference[] {
  return [];
}
