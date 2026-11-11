/** Live counts for the Library tab sections. One small COUNT query per table. */
import { and, count, isNull, ne, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  actionItems,
  collections,
  highlights,
  journalEntries,
  planProgress,
  prayerEntries,
  savedVerses,
  sermonSeries,
  sermons,
  verseNotes,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';

export interface LibraryCounts {
  savedVerses: number;
  highlights: number;
  notes: number;
  sermons: number;
  series: number;
  journal: number;
  prayers: number;
  collections: number;
  /** Open (not completed) action items. */
  openActions: number;
  /** Started plans that are not stopped. */
  plans: number;
}

/** Tables the counts depend on (for live refresh). */
export const LIBRARY_COUNT_TABLES = [
  'saved_verses',
  'highlights',
  'verse_notes',
  'sermons',
  'sermon_series',
  'journal_entries',
  'prayer_entries',
  'collections',
  'action_items',
  'plan_progress',
] as const;

function countWhere(db: AppDatabase, table: SQLiteTable, where: SQL | undefined): number {
  return db.select({ value: count() }).from(table).where(where).get()?.value ?? 0;
}

export function getLibraryCounts(db: AppDatabase): LibraryCounts {
  return {
    savedVerses: countWhere(db, savedVerses, isNull(savedVerses.deletedAt)),
    highlights: countWhere(db, highlights, isNull(highlights.deletedAt)),
    notes: countWhere(db, verseNotes, isNull(verseNotes.deletedAt)),
    sermons: countWhere(db, sermons, isNull(sermons.deletedAt)),
    series: countWhere(db, sermonSeries, isNull(sermonSeries.deletedAt)),
    journal: countWhere(db, journalEntries, isNull(journalEntries.deletedAt)),
    prayers: countWhere(db, prayerEntries, isNull(prayerEntries.deletedAt)),
    collections: countWhere(db, collections, isNull(collections.deletedAt)),
    openActions: countWhere(db, actionItems, and(isNull(actionItems.deletedAt), isNull(actionItems.completedAt))),
    plans: countWhere(db, planProgress, and(isNull(planProgress.deletedAt), ne(planProgress.status, 'abandoned'))),
  };
}
