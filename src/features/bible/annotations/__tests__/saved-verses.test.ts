import { eq } from 'drizzle-orm';

import { outbox, savedVerses } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import {
  findSavedVerse,
  listSavedVersesOverlapping,
  removeSavedVerse,
  saveVerseRange,
  toggleSavedVerse,
} from '@/features/bible/annotations/saved-verses';

const ROM_8_28 = 45_008_028;
const ROM_8_30 = 45_008_030;

describe('saved verses repository', () => {
  test('toggle saves a range, then un-saves it', () => {
    const db = createTestDb();

    const first = toggleSavedVerse(db, ROM_8_28, ROM_8_30);
    expect(first.saved).toBe(true);
    expect(findSavedVerse(db, ROM_8_28, ROM_8_30)?.id).toBe(first.id);

    const second = toggleSavedVerse(db, ROM_8_28, ROM_8_30);
    expect(second).toEqual({ id: first.id, saved: false });
    expect(findSavedVerse(db, ROM_8_28, ROM_8_30)).toBeUndefined();
    expect(db.select().from(outbox).all().map((row) => row.operation)).toEqual(['upsert', 'delete']);
  });

  test('saving again revives the tombstoned row instead of duplicating it', () => {
    const db = createTestDb();
    const { id } = toggleSavedVerse(db, ROM_8_28, ROM_8_28);
    toggleSavedVerse(db, ROM_8_28, ROM_8_28);

    const revived = toggleSavedVerse(db, ROM_8_28, ROM_8_28);

    expect(revived).toEqual({ id, saved: true });
    expect(db.select().from(savedVerses).all()).toHaveLength(1);
    expect(db.select().from(savedVerses).where(eq(savedVerses.id, id)).get()?.version).toBe(3);
  });

  test('saveVerseRange is idempotent', () => {
    const db = createTestDb();
    const id = saveVerseRange(db, ROM_8_28, ROM_8_30);

    expect(saveVerseRange(db, ROM_8_28, ROM_8_30)).toBe(id);
    expect(db.select().from(outbox).all()).toHaveLength(1);
  });

  test('normalises a reversed range', () => {
    const db = createTestDb();
    const id = saveVerseRange(db, ROM_8_30, ROM_8_28);
    expect(findSavedVerse(db, ROM_8_28, ROM_8_30)?.id).toBe(id);
  });

  test('removeSavedVerse tombstones by id and ignores unknown ids', () => {
    const db = createTestDb();
    const id = saveVerseRange(db, ROM_8_28, ROM_8_28);

    removeSavedVerse(db, id);
    removeSavedVerse(db, 'missing');

    expect(findSavedVerse(db, ROM_8_28, ROM_8_28)).toBeUndefined();
    expect(db.select().from(outbox).all()).toHaveLength(2);
  });

  test('lists saved ranges overlapping a chapter', () => {
    const db = createTestDb();
    saveVerseRange(db, ROM_8_28, ROM_8_30);
    saveVerseRange(db, 45_007_025, 45_008_001);
    saveVerseRange(db, 45_009_001, 45_009_002);

    const rows = listSavedVersesOverlapping(db, 45_008_000, 45_008_999).all();

    expect(rows.map((row) => row.startVerseId)).toEqual([45_007_025, ROM_8_28]);
  });
});
