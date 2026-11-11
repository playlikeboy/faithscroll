import { eq } from 'drizzle-orm';

import { outbox } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';

import {
  createSeries,
  deleteSeries,
  findOrCreateSeries,
  getSeries,
  listSeries,
  seriesBookIds,
  updateSeries,
} from '../series-repository';
import { createSermon, deleteSermon, getSermon } from '../sermons-repository';

describe('series repository', () => {
  test('creates a series with trimmed fields and enqueues it', () => {
    const db = createTestDb();

    const series = createSeries(db, { title: ' Living With Grace ', speaker: 'Pastor John', description: '' });

    expect(series).toMatchObject({ title: 'Living With Grace', speaker: 'Pastor John', description: null });
    expect(db.select().from(outbox).where(eq(outbox.entityId, series.id)).all()).toHaveLength(1);
  });

  test('requires a title', () => {
    const db = createTestDb();
    expect(() => createSeries(db, { title: '  ' })).toThrow('Series title is required');
  });

  test('updates fields and bumps the version', () => {
    const db = createTestDb();
    const series = createSeries(db, { title: 'Grace' });

    const updated = updateSeries(db, series.id, { description: 'Eight weeks in Ephesians' });

    expect(updated).toMatchObject({ title: 'Grace', description: 'Eight weeks in Ephesians', version: 2 });
    expect(updateSeries(db, series.id, { title: ' ' })).toMatchObject({ title: 'Grace' });
  });

  test('lists series with live sermon counts and date span', () => {
    const db = createTestDb();
    const grace = createSeries(db, { title: 'Grace' });
    const hope = createSeries(db, { title: 'Hope' });
    createSermon(db, { title: 'One', seriesId: grace.id, sermonDate: '2026-10-01' });
    createSermon(db, { title: 'Two', seriesId: grace.id, sermonDate: '2026-11-01' });
    const removed = createSermon(db, { title: 'Three', seriesId: grace.id, sermonDate: '2026-11-08' });
    deleteSermon(db, removed.id);

    const items = listSeries(db);

    expect(items.map((s) => [s.title, s.sermonCount])).toEqual([
      ['Grace', 2],
      ['Hope', 0],
    ]);
    expect(items[0]).toMatchObject({ firstSermonDate: '2026-10-01', lastSermonDate: '2026-11-01' });
    expect(listSeries(db, { query: 'ho' }).map((s) => s.id)).toEqual([hope.id]);
  });

  test('deleting a series detaches its sermons', () => {
    const db = createTestDb();
    const series = createSeries(db, { title: 'Grace' });
    const sermon = createSermon(db, { title: 'One', seriesId: series.id });

    deleteSeries(db, series.id);

    expect(getSeries(db, series.id)).toBeNull();
    expect(getSermon(db, sermon.id)?.seriesId).toBeNull();
    expect(listSeries(db)).toEqual([]);
  });

  test('findOrCreateSeries reuses a case-insensitive match', () => {
    const db = createTestDb();
    const existing = createSeries(db, { title: 'Living With Grace' });

    expect(findOrCreateSeries(db, 'living with grace').id).toBe(existing.id);
    expect(findOrCreateSeries(db, 'New Series').id).not.toBe(existing.id);
    expect(listSeries(db)).toHaveLength(2);
  });

  test('derives the Bible books discussed from main passages in canonical order', () => {
    const db = createTestDb();
    const series = createSeries(db, { title: 'Grace' });
    const passage = (startVerseId: number, endVerseId: number) => ({ text: 'x', startVerseId, endVerseId });
    createSermon(db, { seriesId: series.id, mainPassage: passage(45008028, 45008039) }); // Romans
    createSermon(db, { seriesId: series.id, mainPassage: passage(40018021, 40018035) }); // Matthew
    createSermon(db, { seriesId: series.id, mainPassage: passage(1001001, 3001001) }); // Genesis–Leviticus
    createSermon(db, { seriesId: series.id }); // no passage

    expect(seriesBookIds(db, series.id)).toEqual([1, 2, 3, 40, 45]);
  });
});
