import type { AppDatabase } from '@/db/types';

import { getReadingProgress } from '../annotations/reading';

export interface InitialPosition {
  /** Verse number to bring into view, or null to start at the top. */
  verse: number | null;
  /** True when the verse was explicitly requested (`?verse=`) and should be briefly highlighted. */
  flash: boolean;
}

/** Where to open a chapter: the requested verse, else the saved position in this chapter, else the top. */
export function resolveInitialPosition(
  db: AppDatabase,
  translationId: string,
  bookId: number,
  chapter: number,
  requestedVerse?: number,
): InitialPosition {
  if (requestedVerse) return { verse: requestedVerse, flash: true };
  const progress = getReadingProgress(db, translationId);
  const isSameChapter = progress?.bookId === bookId && progress.chapter === chapter;
  if (isSameChapter && progress.verse > 1) return { verse: progress.verse, flash: false };
  return { verse: null, flash: false };
}
