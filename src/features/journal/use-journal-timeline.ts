import { useMemo, useState } from 'react';

import { db } from '@/db/client';

import { DEFAULT_JOURNAL_PAGE_SIZE } from './repository';
import { groupTimelineByDay, JOURNAL_TIMELINE_TABLES, loadJournalTimeline, type JournalSection } from './timeline';
import type { JournalEntryType } from './types';
import { useDebouncedValue } from './use-debounced-value';
import { useLiveData } from './use-live-data';

export interface JournalTimelineState {
  sections: JournalSection[];
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  type: JournalEntryType | null;
  setType: (type: JournalEntryType | null) => void;
  search: string;
  setSearch: (search: string) => void;
  /** True when a type filter or search is active. */
  isFiltered: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export function useJournalTimeline(): JournalTimelineState {
  const [type, setType] = useState<JournalEntryType | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(DEFAULT_JOURNAL_PAGE_SIZE);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, error, reload } = useLiveData(
    () => loadJournalTimeline(db, { type, search: debouncedSearch, limit }),
    JOURNAL_TIMELINE_TABLES,
    `${type ?? 'all'}|${debouncedSearch}|${limit}`,
  );

  const sections = useMemo(() => groupTimelineByDay(data ?? []), [data]);
  const hasMore = (data?.length ?? 0) >= limit;

  return {
    sections,
    isLoading: data === undefined && error === null,
    error,
    reload,
    type,
    setType: (next) => {
      setType(next);
      setLimit(DEFAULT_JOURNAL_PAGE_SIZE);
    },
    search,
    setSearch,
    isFiltered: type !== null || debouncedSearch.length > 0,
    hasMore,
    loadMore: () => {
      if (hasMore) setLimit((current) => current + DEFAULT_JOURNAL_PAGE_SIZE);
    },
  };
}
