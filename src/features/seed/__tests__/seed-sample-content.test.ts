import { and, eq, isNull } from 'drizzle-orm';

import {
  actionItems,
  collectionItems,
  entityLinks,
  highlights,
  journalEntries,
  outbox,
  prayerEntries,
  prayerUpdates,
  savedVerses,
  scriptureReferences,
  sermonBookmarks,
  sermonNotes,
  sermonRecordings,
  sermons,
  sermonSeries,
  syncState,
  tags,
  verseNotes,
} from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import { getReadingProgress } from '@/features/bible/annotations';
import { createJournalEntry, getJournalEntry } from '@/features/journal/repository';
import { loadJournalTimeline } from '@/features/journal/timeline';
import { listSavedVerses, listVerseNotes } from '@/features/library/annotation-lists';
import { getLibraryCounts } from '@/features/library/counts';
import { listLinks } from '@/features/links/repository';
import { listPrayers } from '@/features/prayers/repository';
import { listSermonActionItems } from '@/features/sermons/sermon-extras-repository';
import { listSermons } from '@/features/sermons/sermons-repository';
import { assignTag, listAllTags } from '@/features/tags/repository';
import { latestJournalEntryQuery, latestReadingProgressQuery, latestSermonQuery } from '@/features/today/repository';

import { hasSampleContent, readSampleManifest, removeSampleContent, SAMPLE_MARKER_KEY, seedSampleContentOnce } from '..';
import { SAMPLE_JOURNAL_ENTRIES, SAMPLE_PRAYERS } from '../sample-data';

jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));

const NOW = new Date(2026, 10, 12, 9, 0, 0);

function live<T extends { deletedAt: unknown }>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt === null);
}

function outboxCount(db: AppDatabase): number {
  return db.select().from(outbox).all().length;
}

describe('seedSampleContentOnce', () => {
  test('seeds journal, prayers, a sermon, annotations and a reading position', async () => {
    const db = createTestDb();

    await expect(seedSampleContentOnce(db, { now: NOW })).resolves.toBe('seeded');

    const entries = live(db.select().from(journalEntries).all());
    expect(entries).toHaveLength(SAMPLE_JOURNAL_ENTRIES.length);
    expect(new Set(entries.map((entry) => entry.entryType))).toEqual(
      new Set(['reflection', 'bible_study', 'sermon_reflection', 'prayer', 'gratitude', 'personal']),
    );
    expect(entries.every((entry) => entry.prompt)).toBe(true);

    const prayers = live(db.select().from(prayerEntries).all());
    expect(prayers.map((prayer) => prayer.status).sort()).toEqual(['answered', 'archived', 'ongoing', 'praying']);
    expect(prayers.every((prayer) => prayer.reminderAt === null && prayer.reminderNotificationId === null)).toBe(true);
    const answered = prayers.find((prayer) => prayer.status === 'answered');
    expect(answered?.answeredAt).not.toBeNull();
    const answeredUpdates = db.select().from(prayerUpdates).where(eq(prayerUpdates.prayerId, answered!.id)).all();
    expect(answeredUpdates[0]?.content).toMatch(/Grateful/);

    const [sermon] = db.select().from(sermons).all();
    expect(sermon).toEqual(
      expect.objectContaining({ title: 'The Power of Forgiveness', speaker: 'Sample Pastor', mainPassage: 'Matthew 18:21-35' }),
    );
    expect(sermon.mainPassageStartVerseId).toBe(40018021);
    expect(sermon.mainPassageEndVerseId).toBe(40018035);
    expect(db.select().from(sermonSeries).get()?.title).toBe('Living With Grace');
    expect(sermon.seriesId).toBe(db.select().from(sermonSeries).get()?.id);
    expect(db.select().from(sermonNotes).get()?.content).toMatch(/^# The Power of Forgiveness[\s\S]*\[09:40\]/);
    expect(db.select().from(sermonBookmarks).all()).toHaveLength(3);
    expect(listSermonActionItems(db, sermon.id)).toHaveLength(2);

    expect(db.select().from(highlights).all().map((row) => row.color).sort()).toEqual(['gold', 'rose', 'sage', 'sage', 'sky']);
    expect(db.select().from(savedVerses).all()).toHaveLength(4);
    expect(db.select().from(verseNotes).all()).toHaveLength(1);
    expect(db.select().from(collectionItems).all()).toHaveLength(4);

    expect(getReadingProgress(db, 'WEB')).toEqual(expect.objectContaining({ bookId: 43, chapter: 3 }));
  });

  test('tags samples, links the sermon reflection and attaches passages', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });

    const sample = listAllTags(db).find((tag) => tag.name === 'Sample');
    // 7 journal + 4 prayers + sermon + series + 2 actions + 4 saved verses + 1 verse note
    expect(sample?.count).toBe(SAMPLE_JOURNAL_ENTRIES.length + SAMPLE_PRAYERS.length + 1 + 1 + 2 + 4 + 1);

    const sermonId = db.select().from(sermons).get()!.id;
    const reflection = db.select().from(journalEntries).where(eq(journalEntries.entryType, 'sermon_reflection')).get()!;
    expect(listLinks(db, { type: 'journal_entry', id: reflection.id }).map((link) => link.id)).toContain(sermonId);

    const journalRefs = db.select().from(scriptureReferences).where(eq(scriptureReferences.sourceType, 'journal_entry')).all();
    expect(journalRefs.length).toBeGreaterThanOrEqual(SAMPLE_JOURNAL_ENTRIES.length);
    expect(db.select().from(entityLinks).all().length).toBeGreaterThanOrEqual(2);
  });

  test('dates journal entries over the past ten days, newest first', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });

    const timeline = loadJournalTimeline(db);
    expect(timeline).toHaveLength(SAMPLE_JOURNAL_ENTRIES.length);
    expect(timeline[0].entry.entryDate).toBe('2026-11-12');
    expect(timeline[timeline.length - 1].entry.entryDate).toBe('2026-11-02');
    expect(timeline[0].tags.map((tag) => tag.name)).toContain('Sample');
    expect(timeline[0].references.length).toBeGreaterThan(0);
  });

  test('leaves nothing in the outbox', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });
    expect(outboxCount(db)).toBe(0);
  });

  test('keeps outbox entries that existed before seeding', async () => {
    const db = createTestDb();
    db.insert(outbox).values({ entityType: 'tag', entityId: 'pending-change', operation: 'upsert' }).run();

    await seedSampleContentOnce(db, { now: NOW });

    expect(db.select().from(outbox).all().map((row) => row.entityId)).toEqual(['pending-change']);
  });

  test('is idempotent', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });

    await expect(seedSampleContentOnce(db, { now: NOW })).resolves.toBe('skipped');

    expect(db.select().from(journalEntries).all()).toHaveLength(SAMPLE_JOURNAL_ENTRIES.length);
    expect(db.select().from(sermons).all()).toHaveLength(1);
    expect(db.select().from(syncState).where(eq(syncState.key, SAMPLE_MARKER_KEY)).all()).toHaveLength(1);
  });

  test('skips (and never seeds later) when the user already has content', async () => {
    const db = createTestDb();
    createJournalEntry(db, { title: 'Mine', content: 'My own words' });

    await expect(seedSampleContentOnce(db, { now: NOW })).resolves.toBe('skipped');
    expect(readSampleManifest(db)?.status).toBe('skipped');
    expect(db.select().from(sermons).all()).toHaveLength(0);
    expect(hasSampleContent(db)).toBe(false);
  });
});

describe('queries used by the app return the samples', () => {
  test('Library counts, lists and Today "Recently"', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });

    expect(getLibraryCounts(db)).toEqual(
      expect.objectContaining({ savedVerses: 4, highlights: 5, notes: 1, sermons: 1, series: 1, journal: 7, prayers: 4, collections: 1, openActions: 2 }),
    );
    expect(listSavedVerses(db)).toHaveLength(4);
    expect(listVerseNotes(db)).toHaveLength(1);
    expect(listPrayers(db)).toHaveLength(4);
    expect(listSermons(db)[0]).toEqual(expect.objectContaining({ title: 'The Power of Forgiveness', seriesTitle: 'Living With Grace', bookmarkCount: 3 }));
    expect(latestJournalEntryQuery(db).get()?.title).toBe('New every morning');
    expect(latestSermonQuery(db).get()?.title).toBe('The Power of Forgiveness');
    expect(latestReadingProgressQuery(db).get()).toEqual(expect.objectContaining({ bookId: 43, chapter: 3 }));
  });
});

describe('removeSampleContent', () => {
  test('removes only the samples; the user’s own content survives', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });
    const mine = createJournalEntry(db, { title: 'Mine', content: 'My own words' });
    assignTag(db, 'journal_entry', mine.id, 'Hope');
    expect(hasSampleContent(db)).toBe(true);

    const result = removeSampleContent(db);

    expect(result.removed).toBeGreaterThan(20);
    expect(result.notificationIds).toEqual([]);
    expect(hasSampleContent(db)).toBe(false);
    expect(loadJournalTimeline(db).map((item) => item.entry.id)).toEqual([mine.id]);
    expect(getJournalEntry(db, mine.id)).not.toBeNull();
    expect(getLibraryCounts(db)).toEqual(
      expect.objectContaining({ savedVerses: 0, highlights: 0, notes: 0, sermons: 0, series: 0, journal: 1, prayers: 0, collections: 0, openActions: 0 }),
    );
    expect(live(db.select().from(actionItems).all())).toHaveLength(0);
    expect(getReadingProgress(db, 'WEB')).toBeUndefined();

    const liveTags = db.select().from(tags).where(isNull(tags.deletedAt)).all().map((tag) => tag.name);
    expect(liveTags).toEqual(['Hope']);
    expect(readSampleManifest(db)?.status).toBe('removed');
  });

  test('keeps the marker so samples never come back', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });
    removeSampleContent(db);

    await expect(seedSampleContentOnce(db, { now: NOW })).resolves.toBe('skipped');
    expect(db.select().from(journalEntries).where(isNull(journalEntries.deletedAt)).all()).toHaveLength(0);
  });

  test('does not upload deletions of rows that were never synced, but keeps the user’s changes', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });
    const mine = createJournalEntry(db, { title: 'Mine' });

    removeSampleContent(db);

    const pending = db.select().from(outbox).all();
    expect(pending.map((row) => row.entityId)).toEqual([mine.id]);
  });

  test('keeps a delete in the outbox for a sample row that did reach the server', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });
    const synced = db.select().from(prayerEntries).get()!;
    db.insert(syncState).values({ key: `base:prayer_entry:${synced.id}`, value: '1' }).run();

    removeSampleContent(db);

    const pending = db.select().from(outbox).where(and(eq(outbox.entityType, 'prayer_entry'), eq(outbox.entityId, synced.id))).all();
    expect(pending.map((row) => row.operation)).toEqual(['delete']);
  });

  test('keeps a sample sermon the user has recorded audio into', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });
    const sermonId = db.select().from(sermons).get()!.id;
    db.insert(sermonRecordings).values({ id: 'rec-1', sermonId, status: 'saved', durationMs: 1000 }).run();

    removeSampleContent(db);

    expect(db.select().from(sermons).where(eq(sermons.id, sermonId)).get()?.deletedAt).toBeNull();
  });

  test('returns reminder ids of removed items so they can be cancelled', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db, { now: NOW });
    const prayer = db.select().from(prayerEntries).get()!;
    db.update(prayerEntries).set({ reminderNotificationId: 'notif-1', reminderAt: NOW.toISOString() }).where(eq(prayerEntries.id, prayer.id)).run();

    expect(removeSampleContent(db).notificationIds).toEqual(['notif-1']);
  });

  test('is a no-op without samples', () => {
    const db = createTestDb();
    expect(removeSampleContent(db)).toEqual({ removed: 0, notificationIds: [] });
  });
});
