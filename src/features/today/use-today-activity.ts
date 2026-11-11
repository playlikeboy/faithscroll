import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';

import { buildRecentActivity, toContinueReading, type ContinueReading, type RecentActivityItem } from './activity';
import {
  lastChapterReadQuery,
  latestJournalEntryQuery,
  latestReadingProgressQuery,
  latestSermonQuery,
  openActionItemQuery,
  pendingPrayerQuery,
} from './repository';

/** Latest reading position, kept live as the reader saves progress. */
export function useContinueReading(): ContinueReading | null {
  const { data } = useLiveQuery(latestReadingProgressQuery(db));
  return toContinueReading(data[0]);
}

/** Live "recently" list. Each query watches one table, so any edit elsewhere updates Today. */
export function useRecentActivity(now: Date): RecentActivityItem[] {
  const lastChapter = useLiveQuery(lastChapterReadQuery(db)).data[0];
  const sermon = useLiveQuery(latestSermonQuery(db)).data[0];
  const journal = useLiveQuery(latestJournalEntryQuery(db)).data[0];
  const prayer = useLiveQuery(pendingPrayerQuery(db)).data[0];
  const action = useLiveQuery(openActionItemQuery(db)).data[0];
  return buildRecentActivity({ lastChapter, sermon, journal, prayer, action }, now);
}
