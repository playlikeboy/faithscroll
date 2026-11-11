import { readingHistory } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import {
  getReadingProgress,
  listRecentChapters,
  recordChapterRead,
  saveReadingProgress,
} from '@/features/bible/annotations/reading';

describe('reading progress', () => {
  test('upserts one row per translation', () => {
    const db = createTestDb();

    saveReadingProgress(db, { translationId: 'WEB', bookId: 43, chapter: 3, verse: 16, scrollOffset: 420 });
    saveReadingProgress(db, { translationId: 'WEB', bookId: 45, chapter: 8, verse: 28, scrollOffset: 10 });
    saveReadingProgress(db, { translationId: 'KJV', bookId: 1, chapter: 1 });

    expect(getReadingProgress(db, 'WEB')).toEqual(
      expect.objectContaining({ bookId: 45, chapter: 8, verse: 28, scrollOffset: 10 }),
    );
    expect(getReadingProgress(db, 'KJV')).toEqual(expect.objectContaining({ verse: 1, scrollOffset: 0 }));
    expect(getReadingProgress(db, 'NIV')).toBeUndefined();
  });

  test('rejects invalid positions', () => {
    const db = createTestDb();
    expect(() => saveReadingProgress(db, { translationId: 'WEB', bookId: 0, chapter: 1 })).toThrow();
    expect(() => saveReadingProgress(db, { translationId: 'WEB', bookId: 1, chapter: 1, scrollOffset: -5 })).not.toThrow();
    expect(getReadingProgress(db, 'WEB')?.scrollOffset).toBe(0);
  });
});

describe('reading history', () => {
  const morning = new Date(2026, 10, 11, 8, 0, 0);
  const evening = new Date(2026, 10, 11, 21, 30, 0);
  const nextDay = new Date(2026, 10, 12, 7, 0, 0);

  test('records a chapter at most once per local day', () => {
    const db = createTestDb();

    expect(recordChapterRead(db, { translationId: 'WEB', bookId: 43, chapter: 3 }, morning)).toBe(true);
    expect(recordChapterRead(db, { translationId: 'WEB', bookId: 43, chapter: 3 }, evening)).toBe(false);
    expect(recordChapterRead(db, { translationId: 'WEB', bookId: 43, chapter: 4 }, evening)).toBe(true);
    expect(recordChapterRead(db, { translationId: 'WEB', bookId: 43, chapter: 3 }, nextDay)).toBe(true);

    expect(db.select().from(readingHistory).all()).toHaveLength(3);
  });

  test('lists distinct recent chapters, newest first', () => {
    const db = createTestDb();
    recordChapterRead(db, { translationId: 'WEB', bookId: 43, chapter: 3 }, morning);
    recordChapterRead(db, { translationId: 'WEB', bookId: 19, chapter: 23 }, evening);
    recordChapterRead(db, { translationId: 'WEB', bookId: 43, chapter: 3 }, nextDay);

    const recent = listRecentChapters(db, 5).all();

    expect(recent.map((row) => [row.bookId, row.chapter])).toEqual([
      [43, 3],
      [19, 23],
    ]);
    expect(listRecentChapters(db, 1).all()).toHaveLength(1);
  });
});
