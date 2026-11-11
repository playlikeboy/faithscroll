import { eq } from 'drizzle-orm';

import { highlights, outbox } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import {
  getHighlightColors,
  listHighlightsInRange,
  removeHighlights,
  setHighlight,
  setHighlights,
} from '@/features/bible/annotations/highlights';

const JOHN_3_16 = 43_003_016;
const JOHN_3_17 = 43_003_017;

describe('highlights repository', () => {
  test('creates one highlight per verse and enqueues an upsert', () => {
    const db = createTestDb();

    const id = setHighlight(db, JOHN_3_16, 'gold');

    const rows = db.select().from(highlights).all();
    expect(rows).toEqual([expect.objectContaining({ id, verseId: JOHN_3_16, color: 'gold', deletedAt: null })]);
    expect(db.select().from(outbox).all()).toEqual([
      expect.objectContaining({ entityType: 'highlight', entityId: id, operation: 'upsert' }),
    ]);
  });

  test('changing the colour updates the same row and bumps the version', () => {
    const db = createTestDb();
    const id = setHighlight(db, JOHN_3_16, 'gold');

    const sameId = setHighlight(db, JOHN_3_16, 'sky');

    expect(sameId).toBe(id);
    const row = db.select().from(highlights).where(eq(highlights.id, id)).get();
    expect(row).toEqual(expect.objectContaining({ color: 'sky', version: 2 }));
  });

  test('removing tombstones the row and enqueues a delete', () => {
    const db = createTestDb();
    const id = setHighlight(db, JOHN_3_16, 'rose');

    removeHighlights(db, [JOHN_3_16]);

    const row = db.select().from(highlights).where(eq(highlights.id, id)).get();
    expect(row?.deletedAt).not.toBeNull();
    expect(listHighlightsInRange(db, JOHN_3_16, JOHN_3_16).all()).toEqual([]);
    expect(db.select().from(outbox).all().at(-1)).toEqual(
      expect.objectContaining({ entityId: id, operation: 'delete' }),
    );
  });

  test('re-highlighting a tombstoned verse revives that row', () => {
    const db = createTestDb();
    const id = setHighlight(db, JOHN_3_16, 'rose');
    removeHighlights(db, [JOHN_3_16]);

    const revivedId = setHighlight(db, JOHN_3_16, 'sage');

    expect(revivedId).toBe(id);
    const rows = db.select().from(highlights).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({ color: 'sage', deletedAt: null, version: 3 }));
  });

  test('highlights a whole range at once and de-duplicates ids', () => {
    const db = createTestDb();

    const ids = setHighlights(db, [JOHN_3_16, JOHN_3_17, JOHN_3_16], 'gold');

    expect(ids).toHaveLength(2);
    expect(getHighlightColors(db, [JOHN_3_16, JOHN_3_17])).toEqual(
      new Map([
        [JOHN_3_16, 'gold'],
        [JOHN_3_17, 'gold'],
      ]),
    );
  });

  test('removing verses without highlights is a no-op', () => {
    const db = createTestDb();

    removeHighlights(db, [JOHN_3_16]);

    expect(db.select().from(outbox).all()).toEqual([]);
  });

  test('rejects an unknown colour', () => {
    const db = createTestDb();
    expect(() => setHighlight(db, JOHN_3_16, 'neon' as never)).toThrow(/colour/i);
  });

  test('lists only live highlights inside the range', () => {
    const db = createTestDb();
    setHighlights(db, [JOHN_3_16, JOHN_3_17, 43_004_001], 'sky');
    removeHighlights(db, [JOHN_3_17]);

    const rows = listHighlightsInRange(db, 43_003_000, 43_003_999).all();

    expect(rows.map((row) => row.verseId)).toEqual([JOHN_3_16]);
  });
});
