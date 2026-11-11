import { useMemo, useState } from 'react';

import { db } from '@/db/client';
import type { AppDatabase } from '@/db/types';
import { useDebouncedValue } from '@/features/journal/use-debounced-value';
import { useLiveData } from '@/features/journal/use-live-data';
import { listScriptureReferencesForSources, type ScriptureReference } from '@/features/links/scripture-references';

import { groupPrayersByStatus, type PrayerSection } from './grouping';
import { listPrayers } from './repository';
import type { Prayer } from './types';

export interface PrayerListData {
  prayers: Prayer[];
  references: Map<string, ScriptureReference[]>;
}

export const PRAYER_LIST_TABLES = ['prayer_entries', 'scripture_references'] as const;

export function loadPrayerList(database: AppDatabase, search: string): PrayerListData {
  const prayers = listPrayers(database, { search });
  const references = listScriptureReferencesForSources(
    database,
    'prayer_entry',
    prayers.map((prayer) => prayer.id),
  );
  return { prayers, references };
}

export interface PrayerListState {
  sections: PrayerSection[];
  references: Map<string, ScriptureReference[]>;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  search: string;
  setSearch: (search: string) => void;
  isFiltered: boolean;
}

export function usePrayerList(): PrayerListState {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, error, reload } = useLiveData(() => loadPrayerList(db, debouncedSearch), PRAYER_LIST_TABLES, debouncedSearch);
  const sections = useMemo(() => groupPrayersByStatus(data?.prayers ?? []), [data]);

  return {
    sections,
    references: data?.references ?? new Map(),
    isLoading: data === undefined && error === null,
    error,
    reload,
    search,
    setSearch,
    isFiltered: debouncedSearch.length > 0,
  };
}
