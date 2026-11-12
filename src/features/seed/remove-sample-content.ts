/**
 * Remove the seeded sample library — exactly the rows recorded in the marker, nothing else.
 * Deletes are soft (tombstones) through the feature repositories; the marker stays so the
 * samples never come back. Outbox entries for rows the server never saw are dropped.
 */
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import { enqueueChange, tombstone } from '@/db/mutations';
import {
  actionItems,
  collections,
  entityTags,
  highlights,
  journalEntries,
  prayerEntries,
  readingHistory,
  readingProgress,
  savedVerses,
  sermonRecordings,
  sermons,
  sermonSeries,
  tags,
  verseNotes,
  type LinkableType,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import {
  deleteCollection,
  deleteVerseNote,
  listCollectionIdsContaining,
  removeFromCollection,
  removeHighlights,
  removeSavedVerse,
} from '@/features/bible/annotations';
import { deleteJournalEntry, getJournalEntry } from '@/features/journal/repository';
import { deleteActionItem, getActionItem } from '@/features/library/action-items';
import { removeAllLinksFor } from '@/features/links/repository';
import { detachAllScriptureReferencesFor } from '@/features/links/scripture-references';
import { deletePrayer } from '@/features/prayers/repository';
import { deleteSeries, getSeries } from '@/features/sermons/series-repository';
import { deleteSermon, getSermon } from '@/features/sermons/sermons-repository';
import { removeAllTagsFor } from '@/features/tags/repository';
import { nowIso } from '@/lib/time';

import { readSampleManifest, writeSampleManifest, type SampleItems } from './manifest';
import { dropUnsyncedOutboxAfter, outboxWatermark } from './outbox';

export interface RemoveSampleResult {
  /** Number of sample items removed (journal entries, prayers, sermons, verses…). */
  removed: number;
  /** Scheduled reminder notifications on removed items; the caller should cancel them. */
  notificationIds: string[];
}

const NOTHING_REMOVED: RemoveSampleResult = { removed: 0, notificationIds: [] };

/** Remove tags, links and collection memberships that point at an item. */
function detachEverywhere(db: AppDatabase, type: LinkableType, id: string): void {
  removeAllTagsFor(db, type, id);
  removeAllLinksFor(db, { type, id });
  for (const { collectionId } of listCollectionIdsContaining(db, type, id).all()) removeFromCollection(db, collectionId, type, id);
}

function hasRecordings(db: AppDatabase, sermonId: string): boolean {
  const row = db
    .select({ value: count() })
    .from(sermonRecordings)
    .where(and(eq(sermonRecordings.sermonId, sermonId), isNull(sermonRecordings.deletedAt)))
    .get();
  return (row?.value ?? 0) > 0;
}

function reminderIds(db: AppDatabase, items: SampleItems): string[] {
  const prayers = items.prayers.length
    ? db.select({ id: prayerEntries.reminderNotificationId }).from(prayerEntries).where(and(inArray(prayerEntries.id, items.prayers), isNull(prayerEntries.deletedAt))).all()
    : [];
  const actions = items.actionItems.length
    ? db.select({ id: actionItems.reminderNotificationId }).from(actionItems).where(and(inArray(actionItems.id, items.actionItems), isNull(actionItems.deletedAt))).all()
    : [];
  return [...prayers, ...actions].map((row) => row.id).filter((id): id is string => !!id);
}

function removeWritten(db: AppDatabase, items: SampleItems): number {
  let removed = 0;
  for (const id of items.journalEntries) {
    if (!getJournalEntry(db, id)) continue;
    detachEverywhere(db, 'journal_entry', id);
    deleteJournalEntry(db, id);
    removed += 1;
  }
  for (const id of items.prayers) {
    detachEverywhere(db, 'prayer_entry', id);
    if (deletePrayer(db, id)) removed += 1;
  }
  for (const id of items.actionItems) {
    if (!getActionItem(db, id)) continue;
    detachEverywhere(db, 'action_item', id);
    detachAllScriptureReferencesFor(db, 'action_item', id);
    deleteActionItem(db, id);
    removed += 1;
  }
  return removed;
}

/** Sermons the user has since recorded audio into are kept: those recordings are theirs. */
function removeSermons(db: AppDatabase, items: SampleItems): number {
  let removed = 0;
  for (const id of items.sermons) {
    if (!getSermon(db, id) || hasRecordings(db, id)) continue;
    detachEverywhere(db, 'sermon', id);
    detachAllScriptureReferencesFor(db, 'sermon', id);
    deleteSermon(db, id);
    removed += 1;
  }
  for (const id of items.series) {
    if (!getSeries(db, id)) continue;
    detachEverywhere(db, 'sermon_series', id);
    deleteSeries(db, id);
    removed += 1;
  }
  return removed;
}

function removeAnnotations(db: AppDatabase, items: SampleItems): number {
  const highlighted = items.highlights.length
    ? db.select({ verseId: highlights.verseId }).from(highlights).where(and(inArray(highlights.id, items.highlights), isNull(highlights.deletedAt))).all()
    : [];
  removeHighlights(
    db,
    highlighted.map((row) => row.verseId),
  );
  let removed = highlighted.length;
  for (const id of items.savedVerses) {
    if (!isLive(db, savedVerses, savedVerses.id, savedVerses.deletedAt, [id])) continue;
    detachEverywhere(db, 'saved_verse', id);
    removeSavedVerse(db, id);
    removed += 1;
  }
  for (const id of items.verseNotes) {
    if (!isLive(db, verseNotes, verseNotes.id, verseNotes.deletedAt, [id])) continue;
    detachEverywhere(db, 'verse_note', id);
    deleteVerseNote(db, id);
    removed += 1;
  }
  for (const id of items.collections) {
    if (!isLive(db, collections, collections.id, collections.deletedAt, [id])) continue;
    deleteCollection(db, id);
    removed += 1;
  }
  return removed;
}

/** Retire sample tags nobody uses any more (tags the user also applied elsewhere stay). */
function removeUnusedTags(db: AppDatabase, tagIds: readonly string[]): void {
  for (const id of tagIds) {
    const inUse = db.select({ value: count() }).from(entityTags).where(eq(entityTags.tagId, id)).get();
    if ((inUse?.value ?? 0) > 0) continue;
    const result = db
      .update(tags)
      .set(tombstone(tags.version))
      .where(and(eq(tags.id, id), isNull(tags.deletedAt)))
      .run();
    if (result.changes > 0) enqueueChange(db, 'tag', id, 'delete');
  }
}

/** Reading position/history are device-local; only clear them if the reader hasn't moved on. */
function removeReading(db: AppDatabase, items: SampleItems): void {
  const progress = items.readingProgress;
  if (progress) {
    db.delete(readingProgress)
      .where(and(eq(readingProgress.translationId, progress.translationId), eq(readingProgress.updatedAt, progress.updatedAt)))
      .run();
  }
  if (items.readingHistory.length) db.delete(readingHistory).where(inArray(readingHistory.id, items.readingHistory)).run();
}

function isLive(db: AppDatabase, table: SQLiteTable, idColumn: SQLiteColumn, deletedAt: SQLiteColumn, ids: readonly string[]): boolean {
  if (ids.length === 0) return false;
  const row = db
    .select({ value: count() })
    .from(table)
    .where(and(inArray(idColumn, [...ids]), isNull(deletedAt)))
    .get();
  return (row?.value ?? 0) > 0;
}

/** True while at least one seeded sample item is still in the library. */
export function hasSampleContent(db: AppDatabase): boolean {
  const manifest = readSampleManifest(db);
  if (manifest?.status !== 'present') return false;
  const { items } = manifest;
  return (
    isLive(db, journalEntries, journalEntries.id, journalEntries.deletedAt, items.journalEntries) ||
    isLive(db, prayerEntries, prayerEntries.id, prayerEntries.deletedAt, items.prayers) ||
    isLive(db, sermons, sermons.id, sermons.deletedAt, items.sermons) ||
    isLive(db, sermonSeries, sermonSeries.id, sermonSeries.deletedAt, items.series) ||
    isLive(db, actionItems, actionItems.id, actionItems.deletedAt, items.actionItems) ||
    isLive(db, highlights, highlights.id, highlights.deletedAt, items.highlights) ||
    isLive(db, savedVerses, savedVerses.id, savedVerses.deletedAt, items.savedVerses) ||
    isLive(db, verseNotes, verseNotes.id, verseNotes.deletedAt, items.verseNotes) ||
    isLive(db, collections, collections.id, collections.deletedAt, items.collections)
  );
}

/**
 * Soft-delete every seeded sample item that still exists. Content the user created themselves
 * is never touched. Safe to call repeatedly; the marker is kept as "removed".
 */
export function removeSampleContent(db: AppDatabase): RemoveSampleResult {
  return db.transaction((tx) => {
    const manifest = readSampleManifest(tx);
    if (manifest?.status !== 'present') return NOTHING_REMOVED;
    const { items } = manifest;
    const watermark = outboxWatermark(tx);
    const notificationIds = reminderIds(tx, items);
    const removed = removeWritten(tx, items) + removeSermons(tx, items) + removeAnnotations(tx, items);
    removeUnusedTags(tx, items.tags);
    removeReading(tx, items);
    dropUnsyncedOutboxAfter(tx, watermark);
    writeSampleManifest(tx, { ...manifest, status: 'removed', removedAt: nowIso() });
    return { removed, notificationIds };
  });
}
