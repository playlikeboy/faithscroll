import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { db } from '@/db/client';
import { useLiveData } from '@/features/library/use-live-data';
import { logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';

import { EMPTY_BIBLE_SECTIONS, searchBibleSections, type BibleSections } from './bible-sections';
import { isSearchable, normalizeQuery } from './query';
import { searchLibrary, searchMore, searchSavedScripture } from './search-service';
import type { SearchGroup, SearchResponse, SearchResult, SearchResultType } from './types';

const DEBOUNCE_MS = 250;
const PAGE_SIZE = 20;

/** Tables whose changes should refresh visible results. */
export const SEARCH_TABLES = [
  'journal_entries',
  'prayer_entries',
  'prayer_updates',
  'sermons',
  'sermon_series',
  'sermon_notes',
  'transcripts',
  'verse_notes',
  'action_items',
  'collections',
  'tags',
  'entity_tags',
  'scripture_references',
  'saved_verses',
  'highlights',
] as const;

export function useDebouncedValue<T>(value: T, delayMs: number = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

interface ExtraPages {
  query: string;
  byType: Partial<Record<SearchResultType, { results: SearchResult[]; hasMore: boolean }>>;
}

export interface UniversalSearch {
  query: string;
  response: SearchResponse | undefined;
  /** Groups with any "Show more" pages merged in. */
  groups: SearchGroup[];
  scripture: SearchResult[];
  /** Concept search over the bundled Bible, topics and dictionary entries. */
  bible: BibleSections;
  isSearchingBible: boolean;
  /** The bundled Bible could not be searched (personal results still work). */
  bibleError: boolean;
  isSearching: boolean;
  error: Error | undefined;
  loadMore: (type: SearchResultType) => void;
}

function mergeGroups(groups: readonly SearchGroup[], extra: ExtraPages['byType']): SearchGroup[] {
  return groups.map((group) => {
    const more = extra[group.type];
    return more ? { ...group, results: [...group.results, ...more.results], hasMore: more.hasMore } : group;
  });
}

/** Debounced universal search over local personal content. Tracks only the result count. */
export function useUniversalSearch(rawQuery: string): UniversalSearch {
  const query = useDebouncedValue(normalizeQuery(rawQuery));
  const read = useCallback(() => searchLibrary(db, query), [query]);
  const { data: response, error } = useLiveData(read, SEARCH_TABLES);
  const [extra, setExtra] = useState<ExtraPages>({ query: '', byType: {} });
  const tracked = useRef<string | null>(null);

  const scripture = useQuery({
    queryKey: ['library-search', 'scripture', query],
    queryFn: () => searchSavedScripture(db, query),
    enabled: isSearchable(query),
    staleTime: 0,
    gcTime: 0,
  });

  const bible = useQuery({
    queryKey: ['library-search', 'bible', query],
    queryFn: () => searchBibleSections(query),
    enabled: isSearchable(query),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (scripture.error) logger.error('Searching saved Scripture failed', scripture.error);
  }, [scripture.error]);

  useEffect(() => {
    if (bible.error) logger.error('Searching the bundled Bible failed', bible.error);
  }, [bible.error]);

  useEffect(() => {
    if (!response || !query || tracked.current === query) return;
    tracked.current = query;
    track({ name: 'library_search_performed', resultCount: response.total });
  }, [query, response]);

  const groups = useMemo(
    () => mergeGroups(response?.groups ?? [], extra.query === query ? extra.byType : {}),
    [response, extra, query],
  );

  const loadMore = useCallback(
    (type: SearchResultType) => {
      const current = groups.find((group) => group.type === type);
      if (!current?.hasMore) return;
      try {
        const page = searchMore(db, type, query, current.results.length, PAGE_SIZE);
        setExtra((previous) => {
          const base = previous.query === query ? previous.byType : {};
          const existing = base[type]?.results ?? [];
          return { query, byType: { ...base, [type]: { results: [...existing, ...page.results], hasMore: page.hasMore } } };
        });
      } catch (loadError) {
        logger.error('Loading more search results failed', loadError);
      }
    },
    [groups, query],
  );

  return {
    query,
    response,
    groups,
    scripture: scripture.data ?? [],
    bible: bible.data && bible.data.query === query ? bible.data : EMPTY_BIBLE_SECTIONS,
    isSearchingBible: isSearchable(query) && bible.isFetching,
    bibleError: !!bible.error,
    isSearching: normalizeQuery(rawQuery) !== query || scripture.isFetching || (isSearchable(query) && bible.isFetching),
    error,
    loadMore,
  };
}
