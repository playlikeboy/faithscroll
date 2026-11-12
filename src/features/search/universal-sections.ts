/** Builds the list sections of the universal search screen from personal and Bible results. */
import type { DictionaryEntrySummary, TopicSummary } from '@/features/bible/study-data/types';

import type { BibleSections } from './bible-sections';
import type { SemanticVerseResult } from './semantic/types';
import type { SearchGroup, SearchResult, SearchResultType } from './types';

export type SearchRow =
  | { kind: 'personal'; key: string; result: SearchResult }
  | { kind: 'verse'; key: string; verse: SemanticVerseResult }
  | { kind: 'topic'; key: string; topic: TopicSummary }
  | { kind: 'dictionary'; key: string; entry: DictionaryEntrySummary };

export type SectionKind = 'personal' | 'scripture' | 'bible' | 'topics' | 'dictionary';

export interface SearchSection {
  key: string;
  kind: SectionKind;
  title: string;
  /** Personal group type for "Show more", if any. */
  moreType: SearchResultType | null;
  hasMore: boolean;
  data: SearchRow[];
}

const personalRows = (results: readonly SearchResult[]): SearchRow[] =>
  results.map((result) => ({ kind: 'personal', key: `${result.type}:${result.id}`, result }));

/**
 * Personal groups first (your own words), then saved Scripture, then "From the Bible", topics and
 * dictionary entries from the bundled data. Empty sections are left out.
 */
export function buildSearchSections(
  groups: readonly SearchGroup[],
  scripture: readonly SearchResult[],
  bible: BibleSections,
): SearchSection[] {
  const sections: SearchSection[] = [
    ...groups.map((group) => ({
      key: group.type,
      kind: 'personal' as const,
      title: group.label,
      moreType: group.type,
      hasMore: group.hasMore,
      data: personalRows(group.results),
    })),
    { key: 'scripture', kind: 'scripture', title: 'Saved verses & highlights', moreType: null, hasMore: false, data: personalRows(scripture) },
    {
      key: 'bible',
      kind: 'bible',
      title: 'From the Bible',
      moreType: null,
      hasMore: false,
      data: bible.verses.map((verse) => ({ kind: 'verse', key: `verse:${verse.startVerseId}-${verse.endVerseId}`, verse })),
    },
    {
      key: 'topics',
      kind: 'topics',
      title: 'Topics',
      moreType: null,
      hasMore: false,
      data: bible.topics.map((topic) => ({ kind: 'topic', key: `topic:${topic.id}`, topic })),
    },
    {
      key: 'dictionary',
      kind: 'dictionary',
      title: 'Dictionary',
      moreType: null,
      hasMore: false,
      data: bible.dictionary.map((entry) => ({ kind: 'dictionary', key: `dictionary:${entry.id}`, entry })),
    },
  ];
  return sections.filter((section) => section.data.length > 0);
}
