import { and, desc, eq, gte, lt, max } from 'drizzle-orm';
import { z } from 'zod';

import { readingHistory, readingProgress } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

/**
 * Reading progress and history are device-local bookkeeping (not in ENTITY_TYPES),
 * so they are not enqueued for sync.
 */
export type ReadingProgressRow = typeof readingProgress.$inferSelect;

const BOOK_COUNT = 66;

const positionSchema = z.object({
  translationId: z.string().min(1),
  bookId: z.number().int().min(1).max(BOOK_COUNT),
  chapter: z.number().int().min(1),
  verse: z.number().int().min(1).default(1),
  scrollOffset: z
    .number()
    .default(0)
    .transform((value) => (Number.isFinite(value) ? Math.max(0, value) : 0)),
});

export type ReadingPosition = z.input<typeof positionSchema>;

export function saveReadingProgress(db: AppDatabase, position: ReadingPosition): void {
  const values = positionSchema.parse(position);
  const updatedAt = nowIso();
  db.insert(readingProgress)
    .values({ ...values, updatedAt })
    .onConflictDoUpdate({
      target: readingProgress.translationId,
      set: {
        bookId: values.bookId,
        chapter: values.chapter,
        verse: values.verse,
        scrollOffset: values.scrollOffset,
        updatedAt,
      },
    })
    .run();
}

export function getReadingProgress(db: AppDatabase, translationId: string): ReadingProgressRow | undefined {
  return selectReadingProgress(db, translationId).get();
}

/** Query for the progress row of a translation (use with `useLiveQuery`). */
export function selectReadingProgress(db: AppDatabase, translationId: string) {
  return db.select().from(readingProgress).where(eq(readingProgress.translationId, translationId));
}

function localDayBounds(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export interface ChapterVisit {
  translationId: string;
  bookId: number;
  chapter: number;
}

/** Append a history row unless this chapter was already recorded today (local time). Returns true when recorded. */
export function recordChapterRead(db: AppDatabase, visit: ChapterVisit, at: Date = new Date()): boolean {
  const { start, end } = localDayBounds(at);
  return db.transaction((tx) => {
    const existing = tx
      .select({ id: readingHistory.id })
      .from(readingHistory)
      .where(
        and(
          eq(readingHistory.translationId, visit.translationId),
          eq(readingHistory.bookId, visit.bookId),
          eq(readingHistory.chapter, visit.chapter),
          gte(readingHistory.readAt, start),
          lt(readingHistory.readAt, end),
        ),
      )
      .get();
    if (existing) return false;
    tx.insert(readingHistory)
      .values({ id: newId(), ...visit, readAt: at.toISOString() })
      .run();
    return true;
  });
}

/** Distinct recently read chapters, newest first. Returns a query. */
export function listRecentChapters(db: AppDatabase, limit: number) {
  const lastReadAt = max(readingHistory.readAt);
  return db
    .select({ bookId: readingHistory.bookId, chapter: readingHistory.chapter, lastReadAt })
    .from(readingHistory)
    .groupBy(readingHistory.bookId, readingHistory.chapter)
    .orderBy(desc(lastReadAt))
    .limit(limit);
}
