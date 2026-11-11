import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { CapturedBookmark } from '@/components/sermons/bookmark-capture-card';
import { db } from '@/db/client';
import { addBookmark, updateBookmark } from '@/features/sermons/bookmarks-repository';
import { usePickPassage } from '@/features/sermons/use-pick-passage';
import { logger } from '@/lib/logger';
import { formatDuration } from '@/lib/time';
import { track } from '@/services/monitoring/analytics';

import type { BookmarkPosition } from './recording-session';

export interface BookmarkCapture {
  captured: CapturedBookmark | null;
  error: string | null;
  capture: () => void;
  saveNote: (note: string) => void;
  addReference: () => Promise<void>;
  dismiss: () => void;
}

/** Bookmark button behaviour: instant capture + haptic, then an optional note and Bible reference. */
export function useBookmarkCapture(sermonId: string, position: () => BookmarkPosition | null): BookmarkCapture {
  const [captured, setCaptured] = useState<CapturedBookmark | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickPassage = usePickPassage('Bible reference');

  const capture = () => {
    const at = position();
    if (!at) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    try {
      const row = addBookmark(db, { sermonId, recordingId: at.recordingId, positionMs: at.positionMs });
      track({ name: 'bookmark_added' });
      setError(null);
      setCaptured({ id: row.id, elapsedMs: at.elapsedMs, note: null, reference: null });
      AccessibilityInfo.announceForAccessibility(`Bookmarked at ${formatDuration(at.elapsedMs)}`);
    } catch (caught) {
      logger.error('Could not save bookmark', caught);
      setError('That bookmark could not be saved. Please try again.');
    }
  };

  const saveNote = (note: string) => {
    if (!captured) return;
    try {
      const row = updateBookmark(db, captured.id, { note });
      setCaptured({ ...captured, note: row?.note ?? null });
    } catch (caught) {
      logger.error('Could not save bookmark note', caught);
      setError('Your note could not be saved. Please try again.');
    }
  };

  const addReference = async () => {
    if (!captured) return;
    const passage = await pickPassage(null);
    if (!passage) return;
    try {
      updateBookmark(db, captured.id, { reference: passage });
      setCaptured((current) => (current && current.id === captured.id ? { ...current, reference: passage.text } : current));
    } catch (caught) {
      logger.error('Could not save bookmark reference', caught);
      setError('The verse could not be added. Please try again.');
    }
  };

  return { captured, error, capture, saveNote, addReference, dismiss: () => setCaptured(null) };
}
