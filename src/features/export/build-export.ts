/**
 * "Export my data": every personal table as plain JSON. Deleted (tombstoned) rows and rows that
 * belong to deleted parents are left out. Sync bookkeeping (outbox, cursors) is not personal data.
 * Recordings are exported as metadata; the audio files stay on the device.
 */
import { and, inArray, isNull } from 'drizzle-orm';

import {
  actionItems,
  collectionItems,
  collections,
  entityLinks,
  entityTags,
  highlights,
  journalEntries,
  planDayCompletions,
  planProgress,
  prayerEntries,
  prayerUpdates,
  readingHistory,
  readingProgress,
  savedVerses,
  scriptureReferences,
  sermonBookmarks,
  sermonNotes,
  sermonRecaps,
  sermonRecordings,
  sermonSeries,
  sermons,
  syncConflicts,
  tags,
  transcriptSegments,
  transcripts,
  verseNotes,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';

export const EXPORT_FORMAT = 'faithscroll-export';
export const EXPORT_VERSION = 1;

export interface ExportMeta {
  exportedAt: string;
  appVersion: string;
  platform: string;
}

export type ExportData = Record<string, readonly unknown[]>;

export interface DataExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  app: { version: string; platform: string };
  notes: readonly string[];
  counts: Record<string, number>;
  data: ExportData;
}

export const EXPORT_NOTES: readonly string[] = [
  'Bible verses are referenced by verse id: book * 1000000 + chapter * 1000 + verse (World English Bible numbering).',
  'Times are ISO 8601 in UTC. Calendar dates (entry_date, sermon_date) are local YYYY-MM-DD.',
  'Audio recordings are not included in this file. sermonRecordings lists each recording and its file name on this device.',
  'syncConflicts holds copies of text kept when the same item was edited on two devices.',
];

function readPersonalTables(db: AppDatabase): ExportData {
  const activeSermons = db.select({ id: sermons.id }).from(sermons).where(isNull(sermons.deletedAt));
  const activeTranscripts = db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(and(isNull(transcripts.deletedAt), inArray(transcripts.sermonId, activeSermons)));
  const activeCollections = db.select({ id: collections.id }).from(collections).where(isNull(collections.deletedAt));
  const activePrayers = db.select({ id: prayerEntries.id }).from(prayerEntries).where(isNull(prayerEntries.deletedAt));
  const activeTags = db.select({ id: tags.id }).from(tags).where(isNull(tags.deletedAt));
  const activePlans = db.select({ id: planProgress.id }).from(planProgress).where(isNull(planProgress.deletedAt));

  return {
    readingProgress: db.select().from(readingProgress).all(),
    readingHistory: db.select().from(readingHistory).all(),
    highlights: db.select().from(highlights).where(isNull(highlights.deletedAt)).all(),
    savedVerses: db.select().from(savedVerses).where(isNull(savedVerses.deletedAt)).all(),
    verseNotes: db.select().from(verseNotes).where(isNull(verseNotes.deletedAt)).all(),
    collections: db.select().from(collections).where(isNull(collections.deletedAt)).all(),
    collectionItems: db
      .select()
      .from(collectionItems)
      .where(and(isNull(collectionItems.deletedAt), inArray(collectionItems.collectionId, activeCollections)))
      .all(),
    sermonSeries: db.select().from(sermonSeries).where(isNull(sermonSeries.deletedAt)).all(),
    sermons: db.select().from(sermons).where(isNull(sermons.deletedAt)).all(),
    sermonRecordings: db
      .select()
      .from(sermonRecordings)
      .where(and(isNull(sermonRecordings.deletedAt), inArray(sermonRecordings.sermonId, activeSermons)))
      .all(),
    sermonBookmarks: db
      .select()
      .from(sermonBookmarks)
      .where(and(isNull(sermonBookmarks.deletedAt), inArray(sermonBookmarks.sermonId, activeSermons)))
      .all(),
    sermonNotes: db
      .select()
      .from(sermonNotes)
      .where(and(isNull(sermonNotes.deletedAt), inArray(sermonNotes.sermonId, activeSermons)))
      .all(),
    transcripts: db
      .select()
      .from(transcripts)
      .where(and(isNull(transcripts.deletedAt), inArray(transcripts.sermonId, activeSermons)))
      .all(),
    transcriptSegments: db
      .select()
      .from(transcriptSegments)
      .where(inArray(transcriptSegments.transcriptId, activeTranscripts))
      .all(),
    sermonRecaps: db
      .select()
      .from(sermonRecaps)
      .where(and(isNull(sermonRecaps.deletedAt), inArray(sermonRecaps.sermonId, activeSermons)))
      .all(),
    scriptureReferences: db.select().from(scriptureReferences).where(isNull(scriptureReferences.deletedAt)).all(),
    journalEntries: db.select().from(journalEntries).where(isNull(journalEntries.deletedAt)).all(),
    prayerEntries: db.select().from(prayerEntries).where(isNull(prayerEntries.deletedAt)).all(),
    prayerUpdates: db
      .select()
      .from(prayerUpdates)
      .where(and(isNull(prayerUpdates.deletedAt), inArray(prayerUpdates.prayerId, activePrayers)))
      .all(),
    actionItems: db.select().from(actionItems).where(isNull(actionItems.deletedAt)).all(),
    entityLinks: db.select().from(entityLinks).where(isNull(entityLinks.deletedAt)).all(),
    tags: db.select().from(tags).where(isNull(tags.deletedAt)).all(),
    entityTags: db.select().from(entityTags).where(inArray(entityTags.tagId, activeTags)).all(),
    planProgress: db.select().from(planProgress).where(isNull(planProgress.deletedAt)).all(),
    planDayCompletions: db
      .select()
      .from(planDayCompletions)
      .where(inArray(planDayCompletions.planProgressId, activePlans))
      .all(),
    syncConflicts: db.select().from(syncConflicts).all(),
  };
}

/** Build the export document. Synchronous and read-only. */
export function buildExport(db: AppDatabase, meta: ExportMeta): DataExport {
  const data = readPersonalTables(db);
  const counts = Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, rows.length]));
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: meta.exportedAt,
    app: { version: meta.appVersion, platform: meta.platform },
    notes: EXPORT_NOTES,
    counts,
    data,
  };
}

/** e.g. faithscroll-export-2026-11-11.json */
export function exportFileName(exportedAt: string): string {
  return `faithscroll-export-${exportedAt.slice(0, 10)}.json`;
}

/** Short human summary of what was exported, e.g. "12 journal entries, 3 prayers, 2 sermons". */
export function summarizeExport(counts: Record<string, number>): string {
  const labels: [string, string, string][] = [
    ['journalEntries', 'journal entry', 'journal entries'],
    ['prayerEntries', 'prayer', 'prayers'],
    ['sermons', 'sermon', 'sermons'],
    ['verseNotes', 'Bible note', 'Bible notes'],
    ['highlights', 'highlight', 'highlights'],
    ['savedVerses', 'saved verse', 'saved verses'],
  ];
  const parts = labels
    .filter(([key]) => (counts[key] ?? 0) > 0)
    .map(([key, one, many]) => `${counts[key]} ${counts[key] === 1 ? one : many}`);
  return parts.length > 0 ? parts.join(', ') : 'Your settings and reading history';
}
