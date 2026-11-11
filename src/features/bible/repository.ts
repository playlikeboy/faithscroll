/**
 * CONTRACT STUB — owned by the bible-data agent.
 * Read-only access to the bundled Bible database (assets/bible/bible.db).
 * Exported names and signatures are a shared contract: implementations may change, signatures may not.
 */
import type { BibleSearchOptions, BibleSearchResult, Translation, Verse, VerseRange } from './types';

export const DEFAULT_TRANSLATION: Translation = {
  id: 'WEB',
  name: 'World English Bible',
  abbreviation: 'WEB',
  language: 'en',
  license: 'Public Domain',
  attribution: 'The World English Bible is in the public domain.',
};

/** All verses of one chapter in order, with headings / paragraph / poetry markers. */
export async function getChapter(_bookId: number, _chapter: number): Promise<Verse[]> {
  return [];
}

/** Verses in an inclusive range (may span chapters). */
export async function getVerses(_range: VerseRange): Promise<Verse[]> {
  return [];
}

export async function getVerse(_verseId: number): Promise<Verse | null> {
  return null;
}

/** Full-text search (FTS5) over verse text. Empty/whitespace queries return []. */
export async function searchBible(_query: string, _options?: BibleSearchOptions): Promise<BibleSearchResult[]> {
  return [];
}

/** Related passages for a verse, most relevant first. */
export async function getCrossReferences(_verseId: number, _limit?: number): Promise<VerseRange[]> {
  return [];
}

/** Number of verses in a chapter (0 if unknown). */
export function getVerseCount(_bookId: number, _chapter: number): number {
  return 0;
}
