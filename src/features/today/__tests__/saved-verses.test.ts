import { eq } from 'drizzle-orm';

import { outbox, savedVerses } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import {
  removeSavedVerse,
  saveVerseRange,
  savedRangeQuery,
  savedRangesQuery,
} from '@/features/today/saved-verses';

const PSALM_23_1 = 19_023_001;
const ROMANS_8_28 = 45_008_028;

describe('saved verses repository', () => {
  let db: AppDatabase;
  beforeEach(() => {
    db = createTestDb();
  });

  test('saves a range once and queues the change', () => {
    const first = saveVerseRange(db, PSALM_23_1, PSALM_23_1);
    const second = saveVerseRange(db, PSALM_23_1, PSALM_23_1);

    expect(second).toBe(first);
    expect(db.select().from(savedVerses).all()).toHaveLength(1);
    expect(db.select().from(outbox).all()).toEqual([
      expect.objectContaining({ entityType: 'saved_verse', entityId: first, operation: 'upsert' }),
    ]);
    expect(savedRangeQuery(db, PSALM_23_1, PSALM_23_1).get()?.id).toBe(first);
  });

  test('removing soft-deletes, bumps the version and queues a delete', () => {
    const id = saveVerseRange(db, ROMANS_8_28, ROMANS_8_28 + 2);
    removeSavedVerse(db, id);

    const row = db.select().from(savedVerses).where(eq(savedVerses.id, id)).get();
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.version).toBe(2);
    expect(savedRangeQuery(db, ROMANS_8_28, ROMANS_8_28 + 2).all()).toEqual([]);
    expect(db.select().from(outbox).all().map((change) => change.operation)).toEqual(['upsert', 'delete']);
  });

  test('saving again after removal creates a fresh row', () => {
    const id = saveVerseRange(db, PSALM_23_1, PSALM_23_1);
    removeSavedVerse(db, id);

    expect(saveVerseRange(db, PSALM_23_1, PSALM_23_1)).not.toBe(id);
  });

  test('savedRangesQuery returns live rows for the given starts only', () => {
    const kept = saveVerseRange(db, PSALM_23_1, PSALM_23_1);
    saveVerseRange(db, ROMANS_8_28, ROMANS_8_28);

    expect(savedRangesQuery(db, [PSALM_23_1]).all()).toEqual([
      { id: kept, startVerseId: PSALM_23_1, endVerseId: PSALM_23_1 },
    ]);
    expect(savedRangesQuery(db, []).all()).toEqual([]);
  });

  test('rejects invalid ranges', () => {
    expect(() => saveVerseRange(db, ROMANS_8_28, ROMANS_8_28 - 1)).toThrow('Invalid verse range');
    expect(() => saveVerseRange(db, 0, 0)).toThrow('Invalid verse range');
    expect(db.select().from(savedVerses).all()).toEqual([]);
  });
});
