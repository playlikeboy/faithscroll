/**
 * Integrity checks for the bundled Bible database (assets/bible/bible.db) built by
 * scripts/bible/build-bible-db.mjs, and for the generated verse-count table.
 */
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

import { BOOKS } from '@/features/bible/books';
import { OMITTED_VERSE_IDS, VERSE_COUNTS } from '@/features/bible/data/verse-counts';

const DB_PATH = path.join(__dirname, '..', '..', '..', '..', 'assets', 'bible', 'bible.db');
const MAX_DB_BYTES = 25 * 1024 * 1024;
const MAX_REFS_PER_VERSE = 15;

let db: Database.Database;

beforeAll(() => {
  db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
});

afterAll(() => {
  db.close();
});

function textOf(id: number): string | undefined {
  return (db.prepare('SELECT text FROM verses WHERE id = ?').get(id) as { text: string } | undefined)?.text;
}

describe('bible.db', () => {
  test('is smaller than 25 MB', () => {
    expect(fs.statSync(DB_PATH).size).toBeLessThan(MAX_DB_BYTES);
  });

  test("every book's chapter count matches books.ts", () => {
    const rows = db
      .prepare('SELECT book_id AS bookId, COUNT(DISTINCT chapter) AS chapters, MAX(chapter) AS last FROM verses GROUP BY book_id')
      .all() as { bookId: number; chapters: number; last: number }[];
    expect(rows).toHaveLength(66);
    for (const book of BOOKS) {
      const row = rows.find((candidate) => candidate.bookId === book.id);
      expect({ code: book.code, chapters: row?.chapters, last: row?.last }).toEqual({
        code: book.code,
        chapters: book.chapters,
        last: book.chapters,
      });
    }
  });

  test('has a plausible number of verses', () => {
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM verses').get() as { count: number };
    expect(count).toBeGreaterThan(31_000);
    expect(count).toBeLessThan(31_200);
  });

  test('ids encode book, chapter and verse', () => {
    const { bad } = db
      .prepare('SELECT COUNT(*) AS bad FROM verses WHERE id <> book_id * 1000000 + chapter * 1000 + verse')
      .get() as { bad: number };
    expect(bad).toBe(0);
  });

  test('known verses have the expected text', () => {
    expect(textOf(43_011_035)).toBe('Jesus wept.');
    expect(textOf(1_001_001)).toBe('In the beginning, God created the heavens and the earth.');
    expect(textOf(19_023_001)).toBe('Yahweh is my shepherd; I shall lack nothing.');
    expect(textOf(43_003_016)).toBe(
      'For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.',
    );
  });

  test('text has no USFM markup, footnotes or stray whitespace', () => {
    const { bad } = db
      .prepare(
        `SELECT COUNT(*) AS bad FROM verses
         WHERE text = '' OR instr(text, char(92)) > 0 OR instr(text, '|') > 0 OR instr(text, 'strong=') > 0
            OR instr(text, '  ') > 0 OR text <> trim(text) OR text GLOB '* [,.;:!?]*'`,
      )
      .get() as { bad: number };
    expect(bad).toBe(0);
  });

  test('keeps headings, paragraphs and poetry markers', () => {
    const psalm3 = db.prepare('SELECT heading, poetry, paragraph_start AS p FROM verses WHERE id = 19003001').get();
    expect(psalm3).toEqual({ heading: 'A Psalm by David, when he fled from Absalom his son.', poetry: 1, p: 1 });
    const genesis = db.prepare('SELECT poetry, paragraph_start AS p FROM verses WHERE id = 1001003').get();
    expect(genesis).toEqual({ poetry: 0, p: 1 });
    const { firsts } = db
      .prepare('SELECT COUNT(*) AS firsts FROM verses WHERE verse = 1 AND paragraph_start = 0')
      .get() as { firsts: number };
    expect(firsts).toBe(0);
  });

  test('full-text search finds phrases', () => {
    const rows = db
      .prepare(`SELECT rowid AS id FROM verses_fts WHERE verses_fts MATCH '"faith without works"' ORDER BY rowid`)
      .all() as { id: number }[];
    expect(rows.map((row) => row.id)).toContain(59_002_018);
  });

  test('cross references point at existing verses, are positive and capped per verse', () => {
    const { dangling } = db
      .prepare(
        `SELECT COUNT(*) AS dangling FROM cross_references c
         WHERE NOT EXISTS (SELECT 1 FROM verses WHERE id = c.from_verse_id)
            OR NOT EXISTS (SELECT 1 FROM verses WHERE id = c.to_start_verse_id)
            OR NOT EXISTS (SELECT 1 FROM verses WHERE id = c.to_end_verse_id)
            OR c.to_end_verse_id < c.to_start_verse_id OR c.votes <= 0`,
      )
      .get() as { dangling: number };
    expect(dangling).toBe(0);
    const { most } = db
      .prepare('SELECT MAX(n) AS most FROM (SELECT COUNT(*) AS n FROM cross_references GROUP BY from_verse_id)')
      .get() as { most: number };
    expect(most).toBeLessThanOrEqual(MAX_REFS_PER_VERSE);
    const { john316 } = db
      .prepare('SELECT COUNT(*) AS john316 FROM cross_references WHERE from_verse_id = 43003016')
      .get() as { john316: number };
    expect(john316).toBeGreaterThan(0);
  });

  test('records translation, licence and attribution metadata', () => {
    const rows = db.prepare('SELECT key, value FROM metadata').all() as { key: string; value: string }[];
    const metadata = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    expect(metadata).toMatchObject({
      translation_id: 'WEB',
      translation_name: 'World English Bible',
      translation_license: 'Public Domain',
      cross_references_license: 'CC-BY',
    });
    expect(metadata.cross_references_attribution).toContain('OpenBible.info');
    expect(metadata.built_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generated verse counts', () => {
  test('match the highest verse of every chapter in bible.db', () => {
    const rows = db
      .prepare('SELECT book_id AS bookId, chapter, MAX(verse) AS last FROM verses GROUP BY book_id, chapter')
      .all() as { bookId: number; chapter: number; last: number }[];
    expect(rows).toHaveLength(VERSE_COUNTS.reduce((sum, chapters) => sum + chapters.length, 0));
    for (const row of rows) expect(VERSE_COUNTS[row.bookId - 1][row.chapter - 1]).toBe(row.last);
  });

  test('omitted verses are exactly the gaps in bible.db', () => {
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM verses').get() as { total: number };
    const expected = VERSE_COUNTS.flat().reduce((sum, count) => sum + count, 0) - OMITTED_VERSE_IDS.length;
    expect(total).toBe(expected);
    for (const id of OMITTED_VERSE_IDS) expect(textOf(id)).toBeUndefined();
  });
});
