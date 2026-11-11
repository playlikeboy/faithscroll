/**
 * Read-only access to the bundled Bible database (assets/bible/bible.db).
 * Owned by the bible-data agent. Exported names and signatures are a shared contract.
 *
 * Queries run through `getBibleExecutor()` (expo-sqlite in the app, better-sqlite3 in Jest — see
 * `db/testing/node-executor.ts`). Verse ids are book * 1e6 + chapter * 1e3 + verse and are the
 * table's integer primary key, so chapters and ranges are simple id ranges.
 */
import { chapterVerseCount } from './data/chapter-verse-count';
import { getBibleExecutor } from './db/connection';
import type { SqlParam } from './db/executor';
import { toFtsQuery } from './db/fts-query';
import type { BibleSearchOptions, BibleSearchResult, Translation, Verse, VerseRange } from './types';
import { idsToRange, rangeToIds, toVerseId } from './verse-id';

export const DEFAULT_TRANSLATION: Translation = {
  id: 'WEB',
  name: 'World English Bible',
  abbreviation: 'WEB',
  language: 'en',
  license: 'Public Domain',
  attribution: 'The World English Bible is in the public domain.',
};

/** Attribution required by the CC-BY licence of the cross-reference data (show it with "related verses"). */
export const CROSS_REFERENCES_ATTRIBUTION = 'Cross references: OpenBible.info, licensed CC BY';

const VERSE_COLUMNS = 'id, book_id, chapter, verse, text, heading, paragraph_start, poetry';
const BOOK_FACTOR = 1_000_000;
const CHAPTER_SPAN = 999;
const LAST_OT_BOOK = 39;
const LAST_BOOK = 66;
const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;
const DEFAULT_CROSS_REFERENCES = 10;
const MAX_CROSS_REFERENCES = 50;

interface VerseRow {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
  heading: string | null;
  paragraph_start: number;
  poetry: number;
}

function toVerse(row: VerseRow): Verse {
  return {
    id: row.id,
    bookId: row.book_id,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    heading: row.heading,
    paragraphStart: row.paragraph_start === 1,
    poetry: row.poetry === 1,
  };
}

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

async function versesBetween(firstId: number, lastId: number): Promise<Verse[]> {
  if (lastId < firstId) return [];
  const rows = await getBibleExecutor().getAll<VerseRow>(
    `SELECT ${VERSE_COLUMNS} FROM verses WHERE id BETWEEN ? AND ? ORDER BY id`,
    [firstId, lastId],
  );
  return rows.map(toVerse);
}

/** All verses of one chapter in order, with headings / paragraph / poetry markers. */
export async function getChapter(bookId: number, chapter: number): Promise<Verse[]> {
  if (!isPositiveInteger(bookId) || !isPositiveInteger(chapter)) return [];
  const first = toVerseId({ bookId, chapter, verse: 0 });
  return versesBetween(first, first + CHAPTER_SPAN);
}

/** Verses in an inclusive range (may span chapters). */
export async function getVerses(range: VerseRange): Promise<Verse[]> {
  const { startVerseId, endVerseId } = rangeToIds(range);
  if (!Number.isFinite(startVerseId) || !Number.isFinite(endVerseId)) return [];
  return versesBetween(startVerseId, endVerseId);
}

export async function getVerse(verseId: number): Promise<Verse | null> {
  if (!isPositiveInteger(verseId)) return null;
  const row = await getBibleExecutor().getFirst<VerseRow>(`SELECT ${VERSE_COLUMNS} FROM verses WHERE id = ?`, [verseId]);
  return row ? toVerse(row) : null;
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Verse-id window for the book / testament filters (intersected when both are given). */
function searchWindow(options: BibleSearchOptions): [number, number] {
  let firstBook = 1;
  let lastBook = LAST_BOOK;
  if (options.testament === 'OT') lastBook = LAST_OT_BOOK;
  if (options.testament === 'NT') firstBook = LAST_OT_BOOK + 1;
  if (options.bookId !== undefined) {
    firstBook = Math.max(firstBook, options.bookId);
    lastBook = Math.min(lastBook, options.bookId);
  }
  return [firstBook * BOOK_FACTOR, (lastBook + 1) * BOOK_FACTOR - 1];
}

/**
 * Full-text search (FTS5, Porter stemming, diacritics ignored) over verse text, in canonical order.
 * Words are AND-ed; "quoted phrases" match exactly. FTS syntax in the input is treated as text.
 * Empty/whitespace queries return [].
 */
export async function searchBible(query: string, options: BibleSearchOptions = {}): Promise<BibleSearchResult[]> {
  const match = toFtsQuery(query);
  if (!match) return [];
  const [firstId, lastId] = searchWindow(options);
  if (lastId < firstId) return [];
  const limit = clampInteger(options.limit, DEFAULT_SEARCH_LIMIT, 1, MAX_SEARCH_LIMIT);
  const offset = clampInteger(options.offset, 0, 0, Number.MAX_SAFE_INTEGER);
  const params: SqlParam[] = [match, firstId, lastId, limit, offset];
  const rows = await getBibleExecutor().getAll<VerseRow & { snippet: string }>(
    `SELECT v.id, v.book_id, v.chapter, v.verse, v.text, v.heading, v.paragraph_start, v.poetry,
            highlight(verses_fts, 0, '«', '»') AS snippet
       FROM verses_fts
       JOIN verses v ON v.id = verses_fts.rowid
      WHERE verses_fts MATCH ? AND verses_fts.rowid BETWEEN ? AND ?
      ORDER BY verses_fts.rowid
      LIMIT ? OFFSET ?`,
    params,
  );
  return rows.map((row) => ({ verse: toVerse(row), snippet: row.snippet }));
}

/** Related passages for a verse, most relevant first (OpenBible.info votes). */
export async function getCrossReferences(verseId: number, limit?: number): Promise<VerseRange[]> {
  if (!isPositiveInteger(verseId)) return [];
  const count = clampInteger(limit, DEFAULT_CROSS_REFERENCES, 1, MAX_CROSS_REFERENCES);
  const rows = await getBibleExecutor().getAll<{ start: number; end: number }>(
    `SELECT to_start_verse_id AS start, to_end_verse_id AS "end"
       FROM cross_references
      WHERE from_verse_id = ?
      ORDER BY votes DESC, to_start_verse_id
      LIMIT ?`,
    [verseId, count],
  );
  return rows.map((row) => idsToRange(row.start, row.end));
}

/** Number of verses in a chapter (0 if unknown). Synchronous: reads the generated table, not the DB. */
export function getVerseCount(bookId: number, chapter: number): number {
  return chapterVerseCount(bookId, chapter);
}
