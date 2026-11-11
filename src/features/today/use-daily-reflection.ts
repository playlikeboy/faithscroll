import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { db } from '@/db/client';
import type { VerseRange } from '@/features/bible/types';
import { usePassagePicker } from '@/features/bible/use-passage-picker';
import { logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';

import { passageLabel } from './passage';
import { promptForDate } from './reflection-prompts';
import { saveReflection } from './repository';
import { contentFreeError } from './safe-error';

export interface AttachedPassage {
  range: VerseRange;
  label: string;
}

export interface DailyReflection {
  prompt: string;
  text: string;
  setText: (text: string) => void;
  passage: AttachedPassage | null;
  attachPassage: () => void;
  removePassage: () => void;
  canSave: boolean;
  save: () => void;
  /** Id of the entry just saved (for the gentle confirmation), cleared when writing again. */
  savedEntryId: string | null;
  error: string | null;
}

export function useDailyReflection(now: Date): DailyReflection {
  const prompt = promptForDate(now);
  const pickPassage = usePassagePicker();
  const [text, setTextState] = useState('');
  const [passage, setPassage] = useState<AttachedPassage | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setText = (next: string) => {
    setTextState(next);
    if (savedEntryId) setSavedEntryId(null);
  };

  const attachPassage = () => {
    pickPassage({ title: 'Attach a passage', initial: passage?.range ?? null })
      .then((range) => {
        if (range) setPassage({ range, label: passageLabel(range) });
      })
      .catch((err: unknown) => {
        logger.warn('Passage picker failed', { reason: contentFreeError(err).message });
        setError("We couldn't open the passage picker. Please try again.");
      });
  };

  const save = () => {
    try {
      const id = saveReflection(db, { prompt, content: text, passage, date: now });
      track({ name: 'journal_entry_created', entryType: 'reflection' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      AccessibilityInfo.announceForAccessibility('Reflection saved to your journal');
      setTextState('');
      setPassage(null);
      setError(null);
      setSavedEntryId(id);
    } catch (err) {
      logger.error('Failed to save reflection', contentFreeError(err));
      setError("We couldn't save your reflection. It's still here — please try again.");
    }
  };

  return {
    prompt,
    text,
    setText,
    passage,
    attachPassage,
    removePassage: () => setPassage(null),
    canSave: text.trim().length > 0,
    save,
    savedEntryId,
    error,
  };
}
