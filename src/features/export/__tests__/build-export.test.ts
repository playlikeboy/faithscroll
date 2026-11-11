import { tombstone } from '@/db/mutations';
import {
  collectionItems,
  collections,
  entityTags,
  highlights,
  journalEntries,
  outbox,
  planDayCompletions,
  planProgress,
  prayerEntries,
  prayerUpdates,
  readingProgress,
  sermonNotes,
  sermonRecordings,
  sermons,
  syncState,
  tags,
  transcriptSegments,
  transcripts,
} from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import { buildExport, exportFileName, summarizeExport, EXPORT_FORMAT } from '@/features/export/build-export';
import { eq } from 'drizzle-orm';

const META = { exportedAt: '2026-11-11T09:30:00.000Z', appVersion: '1.0.0', platform: 'ios' };

function seed(db: AppDatabase) {
  db.insert(journalEntries)
    .values([
      { id: 'j1', title: 'Grace', content: 'Kept entry', entryDate: '2026-11-10' },
      { id: 'j2', title: 'Gone', content: 'Deleted entry', entryDate: '2026-11-09' },
    ])
    .run();
  db.update(journalEntries).set(tombstone(journalEntries.version)).where(eq(journalEntries.id, 'j2')).run();

  db.insert(sermons)
    .values([
      { id: 's1', title: 'The Power of Forgiveness' },
      { id: 's2', title: 'Deleted sermon' },
    ])
    .run();
  db.update(sermons).set(tombstone(sermons.version)).where(eq(sermons.id, 's2')).run();
  db.insert(sermonNotes)
    .values([
      { id: 'n1', sermonId: 's1', content: 'Seventy times seven' },
      { id: 'n2', sermonId: 's2', content: 'Note of a deleted sermon' },
    ])
    .run();
  db.insert(sermonRecordings)
    .values({ id: 'r1', sermonId: 's1', localFileName: 'r1.m4a', durationMs: 60_000, status: 'saved' })
    .run();
  db.insert(transcripts).values({ id: 't1', sermonId: 's1', status: 'completed', text: 'Peter asked…' }).run();
  db.insert(transcripts).values({ id: 't2', sermonId: 's2', status: 'completed', text: 'Hidden' }).run();
  db.insert(transcriptSegments)
    .values([
      { id: 'ts1', transcriptId: 't1', startMs: 0, endMs: 1000, text: 'Peter asked', sortOrder: 0 },
      { id: 'ts2', transcriptId: 't2', startMs: 0, endMs: 1000, text: 'Hidden', sortOrder: 0 },
    ])
    .run();

  db.insert(prayerEntries).values({ id: 'p1', title: 'For my family' }).run();
  db.insert(prayerUpdates).values({ id: 'pu1', prayerId: 'p1', content: 'Still praying' }).run();
  db.insert(collections).values({ id: 'c1', title: 'Hope' }).run();
  db.insert(collectionItems).values({ id: 'ci1', collectionId: 'c1', entityType: 'sermon', entityId: 's1' }).run();
  db.insert(tags).values([{ id: 'tag1', name: 'grace' }, { id: 'tag2', name: 'old' }]).run();
  db.update(tags).set(tombstone(tags.version)).where(eq(tags.id, 'tag2')).run();
  db.insert(entityTags)
    .values([
      { entityType: 'journal_entry', entityId: 'j1', tagId: 'tag1' },
      { entityType: 'journal_entry', entityId: 'j1', tagId: 'tag2' },
    ])
    .run();
  db.insert(highlights).values({ id: 'h1', verseId: 43_003_016, color: 'gold' }).run();
  db.insert(planProgress).values({ id: 'pp1', planId: 'john-21' }).run();
  db.insert(planDayCompletions).values({ id: 'pd1', planProgressId: 'pp1', day: 1 }).run();
  db.insert(readingProgress).values({ translationId: 'WEB', bookId: 43, chapter: 3 }).run();
  db.insert(outbox).values({ entityType: 'journal_entry', entityId: 'j1', operation: 'upsert' }).run();
  db.insert(syncState).values({ key: 'pull:journal_entries', value: '2026-11-10' }).run();
}

describe('buildExport', () => {
  test('includes live personal rows with metadata', () => {
    const db = createTestDb();
    seed(db);

    const result = buildExport(db, META);

    expect(result).toMatchObject({
      format: EXPORT_FORMAT,
      version: 1,
      exportedAt: META.exportedAt,
      app: { version: '1.0.0', platform: 'ios' },
    });
    expect(result.data.journalEntries).toEqual([expect.objectContaining({ id: 'j1', content: 'Kept entry' })]);
    expect(result.data.sermonRecordings).toEqual([
      expect.objectContaining({ id: 'r1', localFileName: 'r1.m4a', durationMs: 60_000 }),
    ]);
    expect(result.data.prayerUpdates).toHaveLength(1);
    expect(result.data.collectionItems).toHaveLength(1);
    expect(result.data.highlights).toHaveLength(1);
    expect(result.data.planDayCompletions).toHaveLength(1);
    expect(result.data.readingProgress).toHaveLength(1);
    expect(result.notes.join(' ')).toMatch(/Audio recordings are not included/);
  });

  test('excludes tombstoned rows and children of deleted parents', () => {
    const db = createTestDb();
    seed(db);

    const { data } = buildExport(db, META);

    expect(data.sermons).toEqual([expect.objectContaining({ id: 's1' })]);
    expect(data.sermonNotes).toEqual([expect.objectContaining({ id: 'n1' })]);
    expect(data.transcripts).toEqual([expect.objectContaining({ id: 't1' })]);
    expect(data.transcriptSegments).toEqual([expect.objectContaining({ id: 'ts1' })]);
    expect(data.tags).toEqual([expect.objectContaining({ id: 'tag1' })]);
    expect(data.entityTags).toEqual([expect.objectContaining({ tagId: 'tag1' })]);
    expect(JSON.stringify(data)).not.toContain('Deleted entry');
    expect(JSON.stringify(data)).not.toContain('Hidden');
  });

  test('leaves out sync bookkeeping', () => {
    const db = createTestDb();
    seed(db);

    const { data } = buildExport(db, META);

    expect(data).not.toHaveProperty('outbox');
    expect(data).not.toHaveProperty('syncState');
  });

  test('counts rows per table and works on an empty database', () => {
    const db = createTestDb();

    const result = buildExport(db, META);

    expect(Object.values(result.counts).every((count) => count === 0)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

test('summarizeExport describes the main content', () => {
  expect(summarizeExport({ journalEntries: 1, prayerEntries: 3, sermons: 0, highlights: 2 })).toBe(
    '1 journal entry, 3 prayers, 2 highlights',
  );
  expect(summarizeExport({})).toBe('Your settings and reading history');
});

test('exportFileName is dated', () => {
  expect(exportFileName(META.exportedAt)).toBe('faithscroll-export-2026-11-11.json');
});
