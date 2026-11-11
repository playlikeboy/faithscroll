/** Library views over Bible annotations (highlights, saved verses, Bible notes). */
import { asc, desc, eq, isNull, and } from 'drizzle-orm';

import { highlights, savedVerses, verseNotes, type HIGHLIGHT_COLOR_VALUES } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getBook } from '@/features/bible/books';
import { fromVerseId } from '@/features/bible/verse-id';

export type HighlightColorName = (typeof HIGHLIGHT_COLOR_VALUES)[number];

export interface HighlightItem {
  id: string;
  verseId: number;
  color: HighlightColorName;
}

export interface HighlightGroup {
  bookId: number;
  bookName: string;
  items: HighlightItem[];
}

/** Highlights grouped by book in canonical order (verse order inside each book). */
export function listHighlightGroups(db: AppDatabase, color: HighlightColorName | null = null): HighlightGroup[] {
  const filter = color ? and(isNull(highlights.deletedAt), eq(highlights.color, color)) : isNull(highlights.deletedAt);
  const rows = db
    .select({ id: highlights.id, verseId: highlights.verseId, color: highlights.color })
    .from(highlights)
    .where(filter)
    .orderBy(asc(highlights.verseId))
    .all();
  return rows.reduce<HighlightGroup[]>((groups, row) => {
    const { bookId } = fromVerseId(row.verseId);
    const last = groups[groups.length - 1];
    if (last && last.bookId === bookId) {
      return [...groups.slice(0, -1), { ...last, items: [...last.items, row] }];
    }
    return [...groups, { bookId, bookName: getBook(bookId)?.name ?? 'Unknown book', items: [row] }];
  }, []);
}

export type SavedVerseRow = typeof savedVerses.$inferSelect;
export type VerseNoteRow = typeof verseNotes.$inferSelect;

/** Saved verse ranges, most recently saved first. */
export function listSavedVerses(db: AppDatabase): SavedVerseRow[] {
  return db.select().from(savedVerses).where(isNull(savedVerses.deletedAt)).orderBy(desc(savedVerses.createdAt)).all();
}

/** Bible notes, most recently edited first. */
export function listVerseNotes(db: AppDatabase): VerseNoteRow[] {
  return db.select().from(verseNotes).where(isNull(verseNotes.deletedAt)).orderBy(desc(verseNotes.updatedAt)).all();
}
