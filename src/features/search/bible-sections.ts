/**
 * The Bible half of universal search: concept search over the bundled Bible plus matching topics
 * and dictionary entries. Everything runs on the device against the bundled database.
 */
import { findDictionaryEntriesByName, searchDictionary } from '@/features/bible/study-data/repository';
import type { DictionaryEntrySummary, TopicSummary } from '@/features/bible/study-data/types';

import { isSearchable, normalizeQuery } from './query';
import { semanticSearchBible } from './semantic/semantic-search';
import type { SemanticVerseResult } from './semantic/types';

export const BIBLE_RESULT_LIMIT = 6;
export const TOPIC_LIMIT = 6;
export const DICTIONARY_LIMIT = 3;

export interface BibleSections {
  query: string;
  verses: SemanticVerseResult[];
  topics: TopicSummary[];
  dictionary: DictionaryEntrySummary[];
  alsoSearching: string[];
}

export const EMPTY_BIBLE_SECTIONS: BibleSections = { query: '', verses: [], topics: [], dictionary: [], alsoSearching: [] };

async function dictionaryFor(query: string, conceptLabels: readonly string[]): Promise<DictionaryEntrySummary[]> {
  const [named, searched] = await Promise.all([
    findDictionaryEntriesByName([query, ...conceptLabels]),
    searchDictionary(query, { limit: DICTIONARY_LIMIT }),
  ]);
  const unique = new Map<number, DictionaryEntrySummary>();
  for (const entry of [...named, ...searched]) if (!unique.has(entry.id)) unique.set(entry.id, entry);
  return [...unique.values()].slice(0, DICTIONARY_LIMIT);
}

export async function searchBibleSections(rawQuery: string): Promise<BibleSections> {
  const query = normalizeQuery(rawQuery);
  if (!isSearchable(query)) return { ...EMPTY_BIBLE_SECTIONS, query };
  const semantic = await semanticSearchBible(query, { limit: BIBLE_RESULT_LIMIT });
  const dictionary = await dictionaryFor(
    query,
    semantic.expansion.concepts.map((concept) => concept.label),
  );
  return {
    query,
    verses: semantic.results,
    topics: semantic.topics.slice(0, TOPIC_LIMIT),
    dictionary,
    alsoSearching: semantic.expansion.alsoSearching,
  };
}
