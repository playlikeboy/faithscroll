import * as Haptics from 'expo-haptics';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { db } from '@/db/client';
import type { VerseRange } from '@/features/bible/types';
import { rangeToIds } from '@/features/bible/verse-id';
import { logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';

import { contentFreeError } from './safe-error';
import { removeSavedVerse, saveVerseRange, savedRangesQuery } from './saved-verses';

export interface SavedRanges {
  isSaved: (range: VerseRange) => boolean;
  toggle: (range: VerseRange) => void;
  error: string | null;
}

const SAVE_ERROR = "We couldn't update your saved verses. Please try again.";

/** Saved state for a set of passages (Verse of the Day, a Discover session) with save/unsave. */
export function useSavedRanges(ranges: readonly VerseRange[]): SavedRanges {
  const startIds = ranges.map((range) => rangeToIds(range).startVerseId);
  const depsKey = startIds.join(',');
  const { data } = useLiveQuery(savedRangesQuery(db, startIds), [depsKey]);
  const [error, setError] = useState<string | null>(null);

  const findSavedId = (range: VerseRange): string | null => {
    const { startVerseId, endVerseId } = rangeToIds(range);
    return data.find((row) => row.startVerseId === startVerseId && row.endVerseId === endVerseId)?.id ?? null;
  };

  const toggle = (range: VerseRange) => {
    const savedId = findSavedId(range);
    try {
      if (savedId) {
        removeSavedVerse(db, savedId);
        AccessibilityInfo.announceForAccessibility('Removed from saved verses');
      } else {
        const { startVerseId, endVerseId } = rangeToIds(range);
        saveVerseRange(db, startVerseId, endVerseId);
        track({ name: 'verse_saved' });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        AccessibilityInfo.announceForAccessibility('Saved to your library');
      }
      setError(null);
    } catch (err) {
      logger.error('Failed to update saved verse', contentFreeError(err));
      setError(SAVE_ERROR);
    }
  };

  return { isSaved: (range) => findSavedId(range) !== null, toggle, error };
}
