import { eq } from 'drizzle-orm';

import { actionItems, outbox, sermonBookmarks, sermonNotes, sermonRecaps, sermonRecordings, transcripts } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import { newId } from '@/lib/ids';

import { addBookmark } from '../bookmarks-repository';
import { saveSermonNote } from '../notes-repository';
import { createRecordingPart, updateRecording } from '../recordings-repository';
import { createSeries } from '../series-repository';
import { getSermonAiStatus, listSermonActionItems } from '../sermon-extras-repository';
import { createSermon, deleteSermon, getSermon, listSermons, updateSermon } from '../sermons-repository';

function outboxFor(db: ReturnType<typeof createTestDb>, entityId: string) {
  return db.select().from(outbox).where(eq(outbox.entityId, entityId)).all();
}

describe('createSermon', () => {
  test('uses a dated default title when the title is blank and enqueues a sync change', () => {
    const db = createTestDb();

    const sermon = createSermon(db, { title: '   ', sermonDate: '2026-11-08' });

    expect(sermon.title).toBe('Sermon · 8 Nov 2026');
    expect(sermon.sermonDate).toBe('2026-11-08');
    expect(outboxFor(db, sermon.id)).toEqual([expect.objectContaining({ entityType: 'sermon', operation: 'upsert' })]);
  });

  test('stores trimmed metadata and the main passage with verse ids', () => {
    const db = createTestDb();
    const series = createSeries(db, { title: 'Living With Grace' });

    const sermon = createSermon(db, {
      title: ' The Power of Forgiveness ',
      speaker: ' Pastor John ',
      church: 'Grace Community Church',
      seriesId: series.id,
      sermonDate: '2026-11-08',
      mainPassage: { text: 'Matthew 18:21–35', startVerseId: 40018021, endVerseId: 40018035 },
    });

    expect(sermon).toMatchObject({
      title: 'The Power of Forgiveness',
      speaker: 'Pastor John',
      church: 'Grace Community Church',
      seriesId: series.id,
      mainPassage: 'Matthew 18:21–35',
      mainPassageStartVerseId: 40018021,
      mainPassageEndVerseId: 40018035,
    });
  });

  test('defaults the date to today when none is given', () => {
    const db = createTestDb();
    const sermon = createSermon(db, {});
    expect(sermon.sermonDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sermon.title.startsWith('Sermon · ')).toBe(true);
  });

  test('rejects malformed dates', () => {
    const db = createTestDb();
    expect(() => createSermon(db, { sermonDate: '2026-02-31' })).toThrow('Invalid sermon date');
  });
});

describe('updateSermon', () => {
  test('applies only provided fields, bumps the version and enqueues', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace', speaker: 'Ann', sermonDate: '2026-11-01' });

    const updated = updateSermon(db, sermon.id, { speaker: 'Pastor Ann', mainPassage: null });

    expect(updated).toMatchObject({ title: 'Grace', speaker: 'Pastor Ann', mainPassage: null, version: 2 });
    expect(outboxFor(db, sermon.id)).toHaveLength(2);
  });

  test('restores the default title when the title is cleared', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace', sermonDate: '2026-11-01' });

    const updated = updateSermon(db, sermon.id, { title: '' });

    expect(updated?.title).toBe('Sermon · 1 Nov 2026');
  });

  test('returns null for unknown or deleted sermons', () => {
    const db = createTestDb();
    expect(updateSermon(db, 'missing', { title: 'x' })).toBeNull();
  });
});

describe('deleteSermon', () => {
  test('soft-deletes the sermon and its children and returns recording files to remove', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    const part = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'a.m4a' });
    addBookmark(db, { sermonId: sermon.id, recordingId: part.id, positionMs: 1000 });
    saveSermonNote(db, sermon.id, '# Notes');
    db.insert(transcripts).values({ id: newId(), sermonId: sermon.id, status: 'completed' }).run();
    db.insert(sermonRecaps).values({ id: newId(), sermonId: sermon.id, status: 'completed' }).run();

    const result = deleteSermon(db, sermon.id);

    expect(result).toEqual({ recordingFileNames: ['a.m4a'] });
    expect(getSermon(db, sermon.id)).toBeNull();
    const live = (rows: { deletedAt: string | null }[]) => rows.filter((r) => r.deletedAt === null);
    expect(live(db.select().from(sermonRecordings).all())).toHaveLength(0);
    expect(live(db.select().from(sermonBookmarks).all())).toHaveLength(0);
    expect(live(db.select().from(sermonNotes).all())).toHaveLength(0);
    expect(live(db.select().from(transcripts).all())).toHaveLength(0);
    expect(live(db.select().from(sermonRecaps).all())).toHaveLength(0);
    expect(outboxFor(db, sermon.id).at(-1)).toMatchObject({ operation: 'delete' });
  });

  test('is a no-op for unknown sermons', () => {
    const db = createTestDb();
    expect(deleteSermon(db, 'missing')).toEqual({ recordingFileNames: [] });
  });
});

describe('listSermons', () => {
  function seed() {
    const db = createTestDb();
    const series = createSeries(db, { title: 'Living With Grace' });
    const forgiveness = createSermon(db, {
      title: 'The Power of Forgiveness',
      speaker: 'Pastor John',
      church: 'Grace Community Church',
      seriesId: series.id,
      sermonDate: '2026-11-08',
    });
    const hope = createSermon(db, { title: 'Hope Rising', speaker: 'Mary', sermonDate: '2026-11-01' });
    return { db, series, forgiveness, hope };
  }

  test('orders newest first with series title, duration and badge statuses', () => {
    const { db, forgiveness, hope } = seed();
    const part = createRecordingPart(db, { sermonId: forgiveness.id, localFileName: 'a.m4a' });
    updateRecording(db, part.id, { status: 'saved', durationMs: 60_000 });
    const failed = createRecordingPart(db, { sermonId: forgiveness.id, localFileName: 'b.m4a' });
    updateRecording(db, failed.id, { status: 'failed', durationMs: 5_000 });
    db.insert(transcripts).values({ id: newId(), sermonId: forgiveness.id, status: 'completed' }).run();
    db.insert(sermonRecaps).values({ id: newId(), sermonId: forgiveness.id, status: 'processing' }).run();

    const items = listSermons(db);

    expect(items.map((i) => i.id)).toEqual([forgiveness.id, hope.id]);
    expect(items[0]).toMatchObject({
      seriesTitle: 'Living With Grace',
      totalDurationMs: 60_000,
      recordingCount: 1,
      transcriptStatus: 'completed',
      recapStatus: 'processing',
    });
    expect(items[1]).toMatchObject({ seriesTitle: null, totalDurationMs: 0, transcriptStatus: null, recapStatus: null });
  });

  test('searches title, speaker, church and series title case-insensitively', () => {
    const { db, forgiveness, hope } = seed();

    expect(listSermons(db, { query: 'forgive' }).map((i) => i.id)).toEqual([forgiveness.id]);
    expect(listSermons(db, { query: 'MARY' }).map((i) => i.id)).toEqual([hope.id]);
    expect(listSermons(db, { query: 'community' }).map((i) => i.id)).toEqual([forgiveness.id]);
    expect(listSermons(db, { query: 'living grace' }).map((i) => i.id)).toEqual([forgiveness.id]);
    expect(listSermons(db, { query: '100%' })).toEqual([]);
  });

  test('filters by series and hides deleted sermons', () => {
    const { db, series, forgiveness, hope } = seed();
    deleteSermon(db, hope.id);

    expect(listSermons(db).map((i) => i.id)).toEqual([forgiveness.id]);
    expect(listSermons(db, { seriesId: series.id }).map((i) => i.id)).toEqual([forgiveness.id]);
  });

  test('paginates with limit and offset', () => {
    const { db, hope } = seed();
    expect(listSermons(db, { limit: 1, offset: 1 }).map((i) => i.id)).toEqual([hope.id]);
  });
});

describe('sermon extras', () => {
  test('reports the latest transcript and recap status', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    expect(getSermonAiStatus(db, sermon.id)).toEqual({ transcriptStatus: null, recapStatus: null });

    db.insert(transcripts).values({ id: newId(), sermonId: sermon.id, status: 'failed', updatedAt: '2026-11-01T00:00:00.000Z' }).run();
    db.insert(transcripts).values({ id: newId(), sermonId: sermon.id, status: 'queued', updatedAt: '2026-11-02T00:00:00.000Z' }).run();

    expect(getSermonAiStatus(db, sermon.id).transcriptStatus).toBe('queued');
  });

  test('lists action items from the sermon and its recaps', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    const other = createSermon(db, { title: 'Other' });
    const recapId = newId();
    db.insert(sermonRecaps).values({ id: recapId, sermonId: sermon.id, status: 'completed' }).run();
    db.insert(actionItems).values({ id: 'a1', title: 'Forgive someone', sourceType: 'sermon', sourceId: sermon.id }).run();
    db.insert(actionItems).values({ id: 'a2', title: 'Call a friend', sourceType: 'sermon_recap', sourceId: recapId }).run();
    db.insert(actionItems).values({ id: 'a3', title: 'Elsewhere', sourceType: 'sermon', sourceId: other.id }).run();
    db.insert(actionItems)
      .values({ id: 'a4', title: 'Deleted', sourceType: 'sermon', sourceId: sermon.id, deletedAt: '2026-11-01T00:00:00.000Z' })
      .run();

    expect(listSermonActionItems(db, sermon.id).map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });
});
