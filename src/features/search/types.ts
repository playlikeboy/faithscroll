import type { Href } from 'expo-router';

import type { VerseRange } from '@/features/bible/types';

export type SearchResultType =
  | 'journal_entry'
  | 'prayer_entry'
  | 'sermon'
  | 'verse_note'
  | 'action_item'
  | 'collection'
  | 'saved_verse'
  | 'highlight';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  /** Preview around the match (plain text), when the match is in body text. */
  snippet: string | null;
  href: Href;
}

export interface SearchGroup {
  type: SearchResultType;
  label: string;
  results: SearchResult[];
  hasMore: boolean;
}

export interface TagResult {
  id: string;
  name: string;
  itemCount: number;
}

export interface PassageResult {
  range: VerseRange;
  reference: string;
  href: Href;
  /** Personal items that reference or annotate the passage. */
  related: SearchResult[];
}

export interface SearchResponse {
  query: string;
  terms: string[];
  passage: PassageResult | null;
  groups: SearchGroup[];
  tags: TagResult[];
  /** Number of results returned on this page (for privacy-safe analytics). */
  total: number;
}

export const GROUP_LABELS: Readonly<Record<SearchResultType, string>> = {
  journal_entry: 'Journal',
  prayer_entry: 'Prayers',
  sermon: 'Sermons',
  verse_note: 'Bible notes',
  action_item: 'Action items',
  collection: 'Collections',
  saved_verse: 'Saved verses',
  highlight: 'Highlights',
};
