import { useCallback, useEffect, useRef, useState } from 'react';

import { db } from '@/db/client';
import { getErrorMessage, logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';
import { usePreferences } from '@/stores/preferences';

import { recordChapterRead, saveReadingProgress } from '../annotations/reading';
import { resolveInitialPosition, type InitialPosition } from './initial-position';

const SAVE_DELAY_MS = 800;

interface PendingPosition {
  verse: number;
  scrollOffset: number;
}

export interface ReaderSession {
  initial: InitialPosition;
  /** Report the verse at the top of the viewport and the list offset; saved after a short pause. */
  reportPosition: (verse: number, scrollOffset: number) => void;
}

function readInitial(translationId: string, bookId: number, chapter: number, verse?: number): InitialPosition {
  try {
    return resolveInitialPosition(db, translationId, bookId, chapter, verse);
  } catch (error) {
    logger.error('Could not read reading progress', error);
    return { verse: verse ?? null, flash: !!verse };
  }
}

/**
 * Reader bookkeeping: restores the last position, records history (once per chapter per day),
 * persists the reading position while scrolling and tracks `chapter_opened`.
 */
export function useReaderSession(bookId: number, chapter: number, requestedVerse?: number): ReaderSession {
  const translationId = usePreferences((s) => s.translationId);
  const [initial] = useState(() => readInitial(translationId, bookId, chapter, requestedVerse));
  const pending = useRef<PendingPosition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const position = pending.current;
    if (!position) return;
    pending.current = null;
    try {
      saveReadingProgress(db, { translationId, bookId, chapter, ...position });
    } catch (error) {
      logger.error('Could not save reading position', error, { reason: getErrorMessage(error) });
    }
  }, [translationId, bookId, chapter]);

  useEffect(() => {
    try {
      recordChapterRead(db, { translationId, bookId, chapter });
      saveReadingProgress(db, { translationId, bookId, chapter, verse: initial.verse ?? 1, scrollOffset: 0 });
    } catch (error) {
      logger.error('Could not record reading history', error);
    }
    track({ name: 'chapter_opened', bookId, chapter });
    return flush;
  }, [translationId, bookId, chapter, initial.verse, flush]);

  const reportPosition = useCallback(
    (verse: number, scrollOffset: number) => {
      pending.current = { verse, scrollOffset };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  return { initial, reportPosition };
}
