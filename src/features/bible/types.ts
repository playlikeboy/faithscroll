export type Testament = 'OT' | 'NT';

export interface BibleBook {
  /** 1–66 in canonical Protestant order. Used inside verse ids. */
  id: number;
  /** USFM book code, e.g. "GEN", "1CO". */
  code: string;
  name: string;
  /** Short display name, e.g. "Gen", "1 Cor". */
  shortName: string;
  testament: Testament;
  chapters: number;
}

export interface Translation {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
  license: string;
  attribution: string;
}

export interface VerseRef {
  bookId: number;
  chapter: number;
  verse: number;
}

/** Inclusive range. A single verse has start === end. */
export interface VerseRange {
  start: VerseRef;
  end: VerseRef;
}

export interface Verse {
  /** Integer verse id (see verse-id.ts). */
  id: number;
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
  /** Section heading shown before this verse, if any. */
  heading: string | null;
  /** True when this verse begins a new paragraph or stanza. */
  paragraphStart: boolean;
  /** True for poetic lines (Psalms, Proverbs, prophetic poetry…). */
  poetry: boolean;
}

export interface BibleSearchResult {
  verse: Verse;
  /** Verse text with matches wrapped in «» markers for highlighting. */
  snippet: string;
}

export interface BibleSearchOptions {
  limit?: number;
  offset?: number;
  bookId?: number;
  testament?: Testament;
}

export interface FoundReference {
  range: VerseRange;
  /** Matched text as it appears in the source. */
  text: string;
  index: number;
  length: number;
}

export interface DiscoverCard {
  id: string;
  range: VerseRange;
  /** One or two sentences of neutral, factual context (book, speaker, setting). */
  context: string;
}

export interface DiscoverTopic {
  id: string;
  title: string;
  description: string;
  cards: DiscoverCard[];
}
