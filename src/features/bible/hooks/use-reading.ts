import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { usePreferences } from '@/stores/preferences';

import { listRecentChapters, selectReadingProgress, type ReadingProgressRow } from '../annotations/reading';

export interface ReadingProgressState {
  progress: ReadingProgressRow | undefined;
  isLoading: boolean;
  error: Error | undefined;
}

/** Live "continue reading" position for the user's current translation. */
export function useReadingProgress(): ReadingProgressState {
  const translationId = usePreferences((s) => s.translationId);
  const { data, updatedAt, error } = useLiveQuery(selectReadingProgress(db, translationId), [translationId]);
  return { progress: data[0], isLoading: updatedAt === undefined && !error, error };
}

export interface RecentChapter {
  bookId: number;
  chapter: number;
  lastReadAt: string | null;
}

/** Live list of distinct recently read chapters, newest first. */
export function useRecentChapters(limit = 6): { chapters: readonly RecentChapter[]; error: Error | undefined } {
  const { data, error } = useLiveQuery(listRecentChapters(db, limit), [limit]);
  return { chapters: data, error };
}
