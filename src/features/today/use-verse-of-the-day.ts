import { useQuery } from '@tanstack/react-query';

import { getVerseOfTheDay } from '@/features/bible/curated';
import { DEFAULT_TRANSLATION, getVerses } from '@/features/bible/repository';
import type { VerseRange } from '@/features/bible/types';
import { rangeToIds } from '@/features/bible/verse-id';
import { toLocalDateString } from '@/lib/time';
import { usePreferences } from '@/stores/preferences';

import { parseLocalDate } from './dates';
import { joinVerseText, passageLabel } from './passage';

export interface VerseOfTheDay {
  range: VerseRange;
  startVerseId: number;
  endVerseId: number;
  reference: string;
  translation: string;
  /** Null while loading or when the text isn't available on this device. */
  text: string | null;
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

export function translationLabel(translationId: string): string {
  return translationId === DEFAULT_TRANSLATION.id ? DEFAULT_TRANSLATION.abbreviation : translationId;
}

/** Deterministic, offline Verse of the Day for the local calendar date. */
export function useVerseOfTheDay(now: Date): VerseOfTheDay {
  const localDate = toLocalDateString(now);
  const translationId = usePreferences((s) => s.translationId);
  const range = getVerseOfTheDay(parseLocalDate(localDate) ?? now);
  const { startVerseId, endVerseId } = rangeToIds(range);

  const query = useQuery({
    queryKey: ['today', 'verse-of-the-day', translationId, startVerseId, endVerseId],
    queryFn: () => getVerses(range),
    staleTime: Infinity,
  });

  const text = query.data ? joinVerseText(query.data) : null;

  return {
    range,
    startVerseId,
    endVerseId,
    reference: passageLabel(range),
    translation: translationLabel(translationId),
    text: text || null,
    isLoading: query.isPending,
    isError: query.isError,
    retry: () => void query.refetch(),
  };
}
