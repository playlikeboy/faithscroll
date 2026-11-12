import type { TopicSummary } from '@/features/bible/study-data/types';
import type { Testament } from '@/features/bible/types';

import type { ExpandedQuery } from './expand';

/** Why a verse was returned, strongest first: exact phrase > all words > related concept > topic. */
export type MatchKind = 'phrase' | 'all-words' | 'concept' | 'some-words' | 'topic';

export interface MatchedVia {
  kind: MatchKind;
  /** Short, honest explanation for the UI, e.g. "Exact phrase", "Related word: worried", "Topic: Anxiety". */
  label: string;
}

export interface SemanticVerseResult {
  startVerseId: number;
  endVerseId: number;
  /** "Philippians 4:6–7". */
  reference: string;
  /** Verse text (first verses of a longer passage, "…" appended). */
  text: string;
  /** Text with matched words wrapped in «» (FTS matches only). */
  snippet: string | null;
  matchedVia: MatchedVia;
  /** Name of a matched topic that also lists this passage, if any. */
  topic: string | null;
  /** Higher is better; only meaningful for ordering. */
  score: number;
}

export interface SemanticSearchOptions {
  limit?: number;
  testament?: Testament;
  bookId?: number;
}

export interface SemanticSearchResponse {
  expansion: ExpandedQuery;
  /** Topics that match the query or its concepts, best first. */
  topics: TopicSummary[];
  results: SemanticVerseResult[];
}
