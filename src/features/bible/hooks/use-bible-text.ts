import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getChapter, getCrossReferences, getVerseCount, getVerses } from '../repository';
import type { Verse, VerseRange } from '../types';
import { rangeToIds } from '../verse-id';

/** Bible text is bundled and immutable, so it never goes stale. */
const BIBLE_STALE_TIME = Infinity;

export function useChapter(bookId: number, chapter: number): UseQueryResult<Verse[]> {
  return useQuery({
    queryKey: ['bible', 'chapter', bookId, chapter],
    queryFn: () => getChapter(bookId, chapter),
    staleTime: BIBLE_STALE_TIME,
  });
}

/** Verses in a chapter: the synchronous count when known, else the loaded chapter length (0 while unknown). */
export function useVerseCount(bookId: number, chapter: number): { count: number; isLoading: boolean } {
  const known = bookId > 0 && chapter > 0 ? getVerseCount(bookId, chapter) : 0;
  const query = useQuery({
    queryKey: ['bible', 'chapter', bookId, chapter],
    queryFn: () => getChapter(bookId, chapter),
    enabled: known === 0 && bookId > 0 && chapter > 0,
    staleTime: BIBLE_STALE_TIME,
  });
  if (known > 0) return { count: known, isLoading: false };
  return { count: query.data?.length ?? 0, isLoading: query.isLoading };
}

export function useVerses(range: VerseRange | null): UseQueryResult<Verse[]> {
  const ids = range ? rangeToIds(range) : null;
  return useQuery({
    queryKey: ['bible', 'verses', ids?.startVerseId, ids?.endVerseId],
    queryFn: () => (range ? getVerses(range) : Promise.resolve([])),
    enabled: range !== null,
    staleTime: BIBLE_STALE_TIME,
  });
}

export function useCrossReferences(verseId: number, limit: number, enabled = true): UseQueryResult<VerseRange[]> {
  return useQuery({
    queryKey: ['bible', 'cross-references', verseId, limit],
    queryFn: () => getCrossReferences(verseId, limit),
    enabled,
    staleTime: BIBLE_STALE_TIME,
  });
}
