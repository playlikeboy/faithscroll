import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { track } from '@/services/monitoring/analytics';

import { MIN_SEARCH_LENGTH } from '../reader/search-helpers';
import { searchBible } from '../repository';
import type { BibleSearchResult } from '../types';

export const SEARCH_PAGE_SIZE = 25;
export const SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Paginated full-text Bible search. Tracks only the result count, never the query. */
export function useBibleSearch(query: string) {
  const trimmed = query.trim();
  const isEnabled = trimmed.length >= MIN_SEARCH_LENGTH;
  const result = useInfiniteQuery({
    queryKey: ['bible', 'search', trimmed],
    queryFn: ({ pageParam }) => searchBible(trimmed, { limit: SEARCH_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < SEARCH_PAGE_SIZE ? undefined : pages.length * SEARCH_PAGE_SIZE,
    enabled: isEnabled,
    staleTime: Infinity,
  });

  const results = useMemo<BibleSearchResult[]>(() => result.data?.pages.flat() ?? [], [result.data]);
  const firstPage = result.data?.pages[0];
  const trackedQuery = useRef<string | null>(null);

  useEffect(() => {
    if (!isEnabled || !firstPage || trackedQuery.current === trimmed) return;
    trackedQuery.current = trimmed;
    track({ name: 'bible_search_performed', resultCount: firstPage.length });
  }, [isEnabled, firstPage, trimmed]);

  return {
    results,
    isEnabled,
    isLoading: isEnabled && result.isPending,
    isError: result.isError,
    hasNextPage: result.hasNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    fetchNextPage: result.fetchNextPage,
    refetch: result.refetch,
  };
}
