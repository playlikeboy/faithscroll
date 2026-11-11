import { useCallback } from 'react';

import { db } from '@/db/client';

import { ACTION_TABLES, listActionItems, type ActionFilter, type ActionItemRow } from './action-items';
import { resolveActionSources, type ActionSource } from './action-sources';
import {
  listHighlightGroups,
  listSavedVerses,
  listVerseNotes,
  type HighlightColorName,
  type HighlightGroup,
  type SavedVerseRow,
  type VerseNoteRow,
} from './annotation-lists';
import {
  COLLECTION_TABLES,
  getCollectionDetail,
  listCollectionSummaries,
  type CollectionDetail,
  type CollectionSummary,
} from './collection-views';
import { getLibraryCounts, LIBRARY_COUNT_TABLES, type LibraryCounts } from './counts';
import { useLiveData, type LiveData } from './use-live-data';

export function useLibraryCounts(): LiveData<LibraryCounts> {
  const read = useCallback(() => getLibraryCounts(db), []);
  return useLiveData(read, LIBRARY_COUNT_TABLES);
}

export function useHighlightGroups(color: HighlightColorName | null): LiveData<HighlightGroup[]> {
  const read = useCallback(() => listHighlightGroups(db, color), [color]);
  return useLiveData(read, ['highlights']);
}

export function useSavedVerses(): LiveData<SavedVerseRow[]> {
  const read = useCallback(() => listSavedVerses(db), []);
  return useLiveData(read, ['saved_verses']);
}

export function useVerseNotes(): LiveData<VerseNoteRow[]> {
  const read = useCallback(() => listVerseNotes(db), []);
  return useLiveData(read, ['verse_notes']);
}

export function useCollectionSummaries(): LiveData<CollectionSummary[]> {
  const read = useCallback(() => listCollectionSummaries(db), []);
  return useLiveData(read, ['collections', 'collection_items']);
}

export function useCollectionDetail(collectionId: string): LiveData<CollectionDetail | null> {
  const read = useCallback(() => getCollectionDetail(db, collectionId), [collectionId]);
  return useLiveData(read, COLLECTION_TABLES);
}

export interface ActionItemsView {
  items: ActionItemRow[];
  sources: Map<string, ActionSource>;
}

export function useActionItems(filter: ActionFilter): LiveData<ActionItemsView> {
  const read = useCallback(() => {
    const items = listActionItems(db, filter);
    return { items, sources: resolveActionSources(db, items) };
  }, [filter]);
  return useLiveData(read, [...ACTION_TABLES, 'sermons', 'sermon_recaps', 'journal_entries']);
}
