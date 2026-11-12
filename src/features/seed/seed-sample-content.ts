/**
 * Seeds a small, realistic library on a fresh install (journal, prayers, a sermon with notes,
 * highlights, saved verses, a collection and a reading position) so no screen starts empty.
 *
 * - Runs once: a marker row in `sync_state` (see `manifest.ts`) means "never again", even after
 *   the user removes the samples or when seeding was skipped because the user already has data.
 * - Uses the feature repositories, so tags, links, scripture references and tombstones behave
 *   exactly like user-created content.
 * - Sample rows never upload: the outbox entries the repositories create are dropped in the
 *   same transaction.
 */
import { and, count, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { enqueueChange } from '@/db/mutations';
import {
  actionItems,
  collections,
  highlights,
  journalEntries,
  prayerEntries,
  readingHistory,
  readingProgress,
  savedVerses,
  sermons,
  verseNotes,
  type LinkableType,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import {
  addToCollection,
  createCollection,
  createVerseNote,
  getReadingProgress,
  recordChapterRead,
  saveReadingProgress,
  saveVerseRange,
  setHighlight,
} from '@/features/bible/annotations';
import { createJournalEntry } from '@/features/journal/repository';
import { changePrayerStatus, createPrayer } from '@/features/prayers/repository';
import { addBookmark } from '@/features/sermons/bookmarks-repository';
import { saveSermonNote } from '@/features/sermons/notes-repository';
import { createSeries } from '@/features/sermons/series-repository';
import { createSermon } from '@/features/sermons/sermons-repository';
import { assignTag } from '@/features/tags/repository';
import { newId } from '@/lib/ids';
import { toLocalDateString } from '@/lib/time';

import { emptySampleItems, hasSampleMarker, writeSampleManifest, type SampleItems } from './manifest';
import { dropOutboxAfter, outboxWatermark } from './outbox';
import {
  SAMPLE_ACTION_ITEMS,
  SAMPLE_BOOKMARKS,
  SAMPLE_COLLECTION,
  SAMPLE_HIGHLIGHTS,
  SAMPLE_JOURNAL_ENTRIES,
  SAMPLE_PRAYERS,
  SAMPLE_READING,
  SAMPLE_SAVED_VERSES,
  SAMPLE_SERIES,
  SAMPLE_SERMON,
  SAMPLE_SERMON_NOTES,
  SAMPLE_TAG,
  SAMPLE_VERSE_NOTE,
} from './sample-data';

export type SeedResult = 'seeded' | 'skipped';

export interface SeedOptions {
  /** Reference time for the sample dates (tests). */
  now?: Date;
}

/** Hour of the day (local) the sample items appear to have been written. */
const SAMPLE_HOUR = 19;

/** Tables whose sample rows get realistic, past created/updated timestamps. */
type BackdatedTable = 'journal_entries' | 'prayer_entries' | 'sermons' | 'sermon_series';

interface SeedContext {
  db: AppDatabase;
  now: Date;
  items: SampleItems;
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, SAMPLE_HOUR, 0, 0);
}

function backdate(db: AppDatabase, table: BackdatedTable, id: string, at: Date): void {
  const iso = at.toISOString();
  db.run(sql`UPDATE ${sql.identifier(table)} SET created_at = ${iso}, updated_at = ${iso} WHERE id = ${id}`);
}

function addUnique(list: readonly string[], value: string): string[] {
  return list.includes(value) ? [...list] : [...list, value];
}

function tagSample(ctx: SeedContext, type: LinkableType, id: string, extra: readonly string[] = []): void {
  for (const name of [SAMPLE_TAG, ...extra]) {
    const tag = assignTag(ctx.db, type, id, name);
    ctx.items = { ...ctx.items, tags: addUnique(ctx.items.tags, tag.id) };
  }
}

function push(ctx: SeedContext, key: Exclude<keyof SampleItems, 'readingProgress'>, id: string): void {
  ctx.items = { ...ctx.items, [key]: [...ctx.items[key], id] };
}

function insertSermonActionItem(db: AppDatabase, sermonId: string, item: { title: string; notes: string }): string {
  const id = newId();
  db.insert(actionItems).values({ id, title: item.title, notes: item.notes, sourceType: 'sermon', sourceId: sermonId }).run();
  enqueueChange(db, 'action_item', id);
  return id;
}

function seedSermon(ctx: SeedContext): string {
  const { db, now } = ctx;
  const preachedOn = daysAgo(now, SAMPLE_SERMON.daysAgo);
  const series = createSeries(db, SAMPLE_SERIES);
  const sermon = createSermon(db, {
    title: SAMPLE_SERMON.title,
    speaker: SAMPLE_SERMON.speaker,
    church: SAMPLE_SERMON.church,
    seriesId: series.id,
    sermonDate: toLocalDateString(preachedOn),
    mainPassage: SAMPLE_SERMON.mainPassage,
  });
  saveSermonNote(db, sermon.id, SAMPLE_SERMON_NOTES);
  for (const bookmark of SAMPLE_BOOKMARKS) addBookmark(db, { sermonId: sermon.id, recordingId: null, ...bookmark });
  for (const item of SAMPLE_ACTION_ITEMS) {
    const actionId = insertSermonActionItem(db, sermon.id, item);
    push(ctx, 'actionItems', actionId);
    tagSample(ctx, 'action_item', actionId);
  }
  backdate(db, 'sermon_series', series.id, preachedOn);
  backdate(db, 'sermons', sermon.id, preachedOn);
  push(ctx, 'series', series.id);
  push(ctx, 'sermons', sermon.id);
  tagSample(ctx, 'sermon_series', series.id);
  tagSample(ctx, 'sermon', sermon.id, SAMPLE_SERMON.tags);
  return sermon.id;
}

function seedPrayers(ctx: SeedContext): Map<string, string> {
  const ids = new Map<string, string>();
  for (const sample of SAMPLE_PRAYERS) {
    const prayer = createPrayer(ctx.db, sample, { passages: sample.passages });
    if (sample.status !== 'praying') changePrayerStatus(ctx.db, prayer.id, sample.status, sample.statusNote);
    backdate(ctx.db, 'prayer_entries', prayer.id, daysAgo(ctx.now, sample.daysAgo));
    ids.set(sample.key, prayer.id);
    push(ctx, 'prayers', prayer.id);
    tagSample(ctx, 'prayer_entry', prayer.id);
  }
  return ids;
}

function seedJournal(ctx: SeedContext, sermonId: string, prayerIds: ReadonlyMap<string, string>): void {
  for (const sample of SAMPLE_JOURNAL_ENTRIES) {
    const date = daysAgo(ctx.now, sample.daysAgo);
    const prayerId = sample.linkToPrayerKey ? prayerIds.get(sample.linkToPrayerKey) : undefined;
    const links = [
      ...(sample.linkToSermon ? [{ type: 'sermon' as const, id: sermonId }] : []),
      ...(prayerId ? [{ type: 'prayer_entry' as const, id: prayerId }] : []),
    ];
    const entry = createJournalEntry(
      ctx.db,
      { title: sample.title, content: sample.content, entryType: sample.entryType, prompt: sample.prompt, entryDate: toLocalDateString(date) },
      { passages: sample.passages, links },
    );
    backdate(ctx.db, 'journal_entries', entry.id, date);
    push(ctx, 'journalEntries', entry.id);
    tagSample(ctx, 'journal_entry', entry.id, sample.tags);
  }
}

function seedAnnotations(ctx: SeedContext): void {
  const { db } = ctx;
  for (const { verseId, color } of SAMPLE_HIGHLIGHTS) push(ctx, 'highlights', setHighlight(db, verseId, color));

  const collectionId = createCollection(db, SAMPLE_COLLECTION);
  push(ctx, 'collections', collectionId);
  for (const range of SAMPLE_SAVED_VERSES) {
    const savedId = saveVerseRange(db, range.startVerseId, range.endVerseId);
    push(ctx, 'savedVerses', savedId);
    tagSample(ctx, 'saved_verse', savedId);
    addToCollection(db, collectionId, 'saved_verse', savedId);
  }

  const noteId = createVerseNote(db, SAMPLE_VERSE_NOTE);
  push(ctx, 'verseNotes', noteId);
  tagSample(ctx, 'verse_note', noteId);
}

/** Give "Continue reading" something to show, unless the reader already has a position. */
function seedReading(ctx: SeedContext): void {
  const { db } = ctx;
  if (getReadingProgress(db, SAMPLE_READING.translationId)) return;
  saveReadingProgress(db, SAMPLE_READING);
  const saved = getReadingProgress(db, SAMPLE_READING.translationId);
  if (saved) ctx.items = { ...ctx.items, readingProgress: { translationId: saved.translationId, updatedAt: saved.updatedAt } };

  const readAt = daysAgo(ctx.now, 0);
  const visit = { translationId: SAMPLE_READING.translationId, bookId: SAMPLE_READING.bookId, chapter: SAMPLE_READING.chapter };
  if (!recordChapterRead(db, visit, readAt)) return;
  const row = db
    .select({ id: readingHistory.id })
    .from(readingHistory)
    .where(and(eq(readingHistory.readAt, readAt.toISOString()), eq(readingHistory.bookId, visit.bookId)))
    .get();
  if (row) push(ctx, 'readingHistory', row.id);
}

function hasLiveRows(db: AppDatabase, table: SQLiteTable, where: SQL): boolean {
  return (db.select({ value: count() }).from(table).where(where).get()?.value ?? 0) > 0;
}

/** True when the user already has personal content (e.g. restored from sync): don't add samples then. */
export function hasUserContent(db: AppDatabase): boolean {
  return (
    hasLiveRows(db, journalEntries, isNull(journalEntries.deletedAt)) ||
    hasLiveRows(db, prayerEntries, isNull(prayerEntries.deletedAt)) ||
    hasLiveRows(db, sermons, isNull(sermons.deletedAt)) ||
    hasLiveRows(db, highlights, isNull(highlights.deletedAt)) ||
    hasLiveRows(db, savedVerses, isNull(savedVerses.deletedAt)) ||
    hasLiveRows(db, verseNotes, isNull(verseNotes.deletedAt)) ||
    hasLiveRows(db, collections, isNull(collections.deletedAt)) ||
    hasLiveRows(db, actionItems, isNull(actionItems.deletedAt)) ||
    hasLiveRows(db, readingProgress, sql`1 = 1`)
  );
}

function seedAll(db: AppDatabase, now: Date): SampleItems {
  const ctx: SeedContext = { db, now, items: emptySampleItems() };
  const sermonId = seedSermon(ctx);
  const prayerIds = seedPrayers(ctx);
  seedJournal(ctx, sermonId, prayerIds);
  seedAnnotations(ctx);
  seedReading(ctx);
  return ctx.items;
}

/**
 * Seed the sample library once per install. Call after migrations, before the UI reads data.
 * Returns 'skipped' when the marker exists or the user already has content (the marker is then
 * written so samples never appear later). All writes happen in one transaction.
 */
export async function seedSampleContentOnce(db: AppDatabase, options: SeedOptions = {}): Promise<SeedResult> {
  const now = options.now ?? new Date();
  return db.transaction((tx) => {
    if (hasSampleMarker(tx)) return 'skipped';
    const seededAt = now.toISOString();
    if (hasUserContent(tx)) {
      writeSampleManifest(tx, { version: 1, status: 'skipped', seededAt, removedAt: null, items: emptySampleItems() });
      return 'skipped';
    }
    const watermark = outboxWatermark(tx);
    const items = seedAll(tx, now);
    dropOutboxAfter(tx, watermark);
    writeSampleManifest(tx, { version: 1, status: 'present', seededAt, removedAt: null, items });
    return 'seeded';
  });
}
