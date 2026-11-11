import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Share } from 'react-native';

import { db } from '@/db/client';
import { getErrorMessage, logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';

import { removeHighlights, setHighlights, type HighlightColorValue } from '../annotations/highlights';
import { toggleSavedVerse } from '../annotations/saved-verses';
import { createVerseNote } from '../annotations/verse-notes';
import { DEFAULT_TRANSLATION } from '../repository';
import { buildShareMessage } from './share';

export interface VerseActionTarget {
  startVerseId: number;
  endVerseId: number;
  /** Every verse id in the range (needed for per-verse highlights). */
  verseIds: readonly number[];
  reference: string;
  passageText: string;
}

const gentleHaptic = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

/** Writes behind the verse action sheet, with haptics, analytics and friendly errors. */
export function useVerseActions(target: VerseActionTarget) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { startVerseId, endVerseId, verseIds, reference, passageText } = target;

  const attempt = useCallback(<T,>(action: string, message: string, fn: () => T): T | null => {
    try {
      setErrorMessage(null);
      return fn();
    } catch (error) {
      logger.error(`Verse action failed: ${action}`, error, { reason: getErrorMessage(error) });
      setErrorMessage(message);
      return null;
    }
  }, []);

  const highlight = useCallback(
    (color: HighlightColorValue) => {
      const done = attempt('highlight', "We couldn't save that highlight.", () => setHighlights(db, verseIds, color));
      if (done) {
        gentleHaptic();
        track({ name: 'verse_highlighted' });
      }
    },
    [attempt, verseIds],
  );

  const removeHighlight = useCallback(() => {
    attempt('remove-highlight', "We couldn't remove that highlight.", () => removeHighlights(db, verseIds));
  }, [attempt, verseIds]);

  const toggleBookmark = useCallback(() => {
    const result = attempt('bookmark', "We couldn't update your bookmark.", () =>
      toggleSavedVerse(db, startVerseId, endVerseId),
    );
    if (!result) return;
    gentleHaptic();
    if (result.saved) track({ name: 'verse_saved' });
  }, [attempt, startVerseId, endVerseId]);

  /** Creates an empty note for the range and returns its id (null on failure). */
  const addNote = useCallback((): string | null => {
    const id = attempt('add-note', "We couldn't start a note.", () => createVerseNote(db, { startVerseId, endVerseId }));
    if (id) track({ name: 'verse_note_created' });
    return id;
  }, [attempt, startVerseId, endVerseId]);

  const share = useCallback(async () => {
    try {
      setErrorMessage(null);
      await Share.share({ message: buildShareMessage(reference, passageText, DEFAULT_TRANSLATION.name) });
    } catch (error) {
      logger.error('Verse share failed', error);
      setErrorMessage("Sharing isn't available right now.");
    }
  }, [reference, passageText]);

  return { errorMessage, highlight, removeHighlight, toggleBookmark, addNote, share };
}
