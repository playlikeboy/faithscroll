import { eq } from 'drizzle-orm';

import {
  actionItems,
  journalEntries,
  outbox,
  prayerEntries,
  readingHistory,
  readingProgress,
  scriptureReferences,
  sermons,
} from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import { idsToRange } from '@/features/bible/verse-id';
import {
  lastChapterReadQuery,
  latestJournalEntryQuery,
  latestReadingProgressQuery,
  latestSermonQuery,
  openActionItemQuery,
  pendingPrayerQuery,
  saveReflection,
} from '@/features/today/repository';

const EARLIER = '2026-11-09T08:00:00.000Z';
const LATER = '2026-11-10T08:00:00.000Z';
const DELETED = '2026-11-10T09:00:00.000Z';

describe('today repository — reads', () => {
  let db: AppDatabase;
  beforeEach(() => {
    db = createTestDb();
  });

  test('every query returns nothing for an empty library', () => {
    expect(latestReadingProgressQuery(db).all()).toEqual([]);
    expect(lastChapterReadQuery(db).all()).toEqual([]);
    expect(latestSermonQuery(db).all()).toEqual([]);
    expect(latestJournalEntryQuery(db).all()).toEqual([]);
    expect(pendingPrayerQuery(db).all()).toEqual([]);
    expect(openActionItemQuery(db).all()).toEqual([]);
  });

  test('latest reading progress across translations', () => {
    db.insert(readingProgress).values({ translationId: 'WEB', bookId: 43, chapter: 3, verse: 16, updatedAt: LATER }).run();
    db.insert(readingProgress).values({ translationId: 'KJV', bookId: 1, chapter: 1, updatedAt: EARLIER }).run();

    expect(latestReadingProgressQuery(db).get()).toEqual(expect.objectContaining({ bookId: 43, chapter: 3, verse: 16 }));
  });

  test('last chapter read comes from reading history', () => {
    db.insert(readingHistory).values({ id: 'h1', translationId: 'WEB', bookId: 19, chapter: 23, readAt: EARLIER }).run();
    db.insert(readingHistory).values({ id: 'h2', translationId: 'WEB', bookId: 45, chapter: 8, readAt: LATER }).run();

    expect(lastChapterReadQuery(db).get()?.id).toBe('h2');
  });

  test('latest sermon and journal entry skip deleted rows', () => {
    db.insert(sermons).values({ id: 's1', title: 'Grace', updatedAt: EARLIER }).run();
    db.insert(sermons).values({ id: 's2', title: 'Removed', updatedAt: LATER, deletedAt: DELETED }).run();
    db.insert(journalEntries).values({ id: 'j1', content: 'Kept', entryDate: '2026-11-09', updatedAt: EARLIER }).run();
    db.insert(journalEntries)
      .values({ id: 'j2', content: 'Gone', entryDate: '2026-11-10', updatedAt: LATER, deletedAt: DELETED })
      .run();

    expect(latestSermonQuery(db).get()?.id).toBe('s1');
    expect(latestJournalEntryQuery(db).get()?.id).toBe('j1');
  });

  test('pending prayer ignores answered, archived and deleted prayers', () => {
    db.insert(prayerEntries).values({ id: 'p1', title: 'Answered', status: 'answered', updatedAt: LATER }).run();
    db.insert(prayerEntries).values({ id: 'p2', title: 'Archived', status: 'archived', updatedAt: LATER }).run();
    db.insert(prayerEntries).values({ id: 'p3', title: 'Deleted', updatedAt: LATER, deletedAt: DELETED }).run();
    db.insert(prayerEntries).values({ id: 'p4', title: 'Ongoing', status: 'ongoing', updatedAt: EARLIER }).run();

    expect(pendingPrayerQuery(db).all()).toEqual([expect.objectContaining({ id: 'p4', title: 'Ongoing' })]);
  });

  test('open action item ignores completed and deleted items', () => {
    db.insert(actionItems).values({ id: 'a1', title: 'Done', completedAt: LATER, createdAt: LATER }).run();
    db.insert(actionItems).values({ id: 'a2', title: 'Deleted', createdAt: LATER, deletedAt: DELETED }).run();
    db.insert(actionItems).values({ id: 'a3', title: 'Call a friend', createdAt: EARLIER }).run();

    expect(openActionItemQuery(db).get()?.id).toBe('a3');
  });
});

describe('saveReflection', () => {
  let db: AppDatabase;
  beforeEach(() => {
    db = createTestDb();
  });

  test('creates a reflection journal entry and queues it for sync', () => {
    const id = saveReflection(db, {
      prompt: 'What am I learning?',
      content: '  Patience.  ',
      date: new Date(2026, 10, 11, 21, 30),
    });

    const entry = db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();
    expect(entry).toEqual(
      expect.objectContaining({
        entryType: 'reflection',
        prompt: 'What am I learning?',
        content: 'Patience.',
        entryDate: '2026-11-11',
      }),
    );
    expect(db.select().from(scriptureReferences).all()).toEqual([]);
    expect(db.select().from(outbox).all()).toEqual([
      expect.objectContaining({ entityType: 'journal_entry', entityId: id, operation: 'upsert' }),
    ]);
  });

  test('attaches a passage as a user scripture reference in the same transaction', () => {
    const range = idsToRange(45_008_028, 45_008_030);
    const id = saveReflection(db, {
      prompt: 'What has been on your heart lately?',
      content: 'Trusting God with the outcome.',
      passage: { range, label: 'Romans 8:28–30' },
    });

    const refs = db.select().from(scriptureReferences).all();
    expect(refs).toEqual([
      expect.objectContaining({
        sourceType: 'journal_entry',
        sourceId: id,
        startVerseId: 45_008_028,
        endVerseId: 45_008_030,
        referenceText: 'Romans 8:28–30',
        origin: 'user',
      }),
    ]);
    const queued = db.select().from(outbox).all().map((row) => row.entityType);
    expect(queued).toEqual(['journal_entry', 'scripture_reference']);
  });

  test('rejects an empty reflection without writing anything', () => {
    expect(() => saveReflection(db, { prompt: 'What am I grateful for?', content: '   ' })).toThrow('empty');
    expect(db.select().from(journalEntries).all()).toEqual([]);
    expect(db.select().from(outbox).all()).toEqual([]);
  });
});
