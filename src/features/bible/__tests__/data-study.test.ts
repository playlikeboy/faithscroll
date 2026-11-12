/**
 * Integrity checks for the study data bundled in assets/bible/bible.db: the merged topical index
 * (OpenBible.info topics + Nave's Topical Bible) and Easton's Bible Dictionary.
 */
import path from 'path';

import Database from 'better-sqlite3';

const DB_PATH = path.join(__dirname, '..', '..', '..', '..', 'assets', 'bible', 'bible.db');

let db: Database.Database;

beforeAll(() => {
  db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
});

afterAll(() => {
  db.close();
});

function count(sql: string, ...params: unknown[]): number {
  return (db.prepare(sql).get(...params) as { n: number }).n;
}

function topicId(normalized: string): number | undefined {
  return (db.prepare('SELECT id FROM topics WHERE normalized = ?').get(normalized) as { id: number } | undefined)?.id;
}

describe('topical index', () => {
  test('has thousands of topics and verse links from both sources', () => {
    expect(count('SELECT COUNT(*) AS n FROM topics')).toBeGreaterThan(10_000);
    expect(count('SELECT COUNT(*) AS n FROM topic_verses WHERE source = 1')).toBeGreaterThan(60_000);
    expect(count('SELECT COUNT(*) AS n FROM topic_verses WHERE source = 2')).toBeGreaterThan(70_000);
  });

  test('"Love" includes 1 Corinthians 13:4', () => {
    const id = topicId('love');
    expect(id).toBeDefined();
    expect(
      count('SELECT COUNT(*) AS n FROM topic_verses WHERE topic_id = ? AND start_verse_id <= 46013004 AND end_verse_id >= 46013004', id),
    ).toBeGreaterThan(0);
  });

  test('everyday topics exist with their best-known verses', () => {
    const anxiety = topicId('anxiety');
    expect(count('SELECT COUNT(*) AS n FROM topic_verses WHERE topic_id = ? AND start_verse_id = 50004006', anxiety)).toBeGreaterThan(0);
    const forgiveness = topicId('forgiveness');
    expect(count('SELECT COUNT(*) AS n FROM topic_verses WHERE topic_id = ?', forgiveness)).toBeGreaterThan(20);
  });

  test('verse links are valid inclusive ranges of existing verses', () => {
    const bad = count(
      `SELECT COUNT(*) AS n FROM topic_verses t
        WHERE t.end_verse_id < t.start_verse_id
           OR NOT EXISTS (SELECT 1 FROM verses WHERE id = t.start_verse_id)
           OR NOT EXISTS (SELECT 1 FROM verses WHERE id = t.end_verse_id)
           OR NOT EXISTS (SELECT 1 FROM topics WHERE id = t.topic_id)`,
    );
    expect(bad).toBe(0);
  });

  test("Nave's subtopics are clean labels and see-also links resolve", () => {
    const love = topicId('love');
    const labels = (db.prepare('SELECT label FROM topic_subtopics WHERE topic_id = ? ORDER BY subtopic').all(love) as { label: string }[]).map(
      (row) => row.label,
    );
    expect(labels).toContain('Of man for God');
    expect(count("SELECT COUNT(*) AS n FROM topic_subtopics WHERE label = '' OR label GLOB '*<*' OR label GLOB '*;;*'")).toBe(0);
    const anxietyLinks = db
      .prepare('SELECT t.normalized FROM topic_links l JOIN topics t ON t.id = l.target_topic_id WHERE l.topic_id = ?')
      .all(topicId('anxiety')) as { normalized: string }[];
    expect(anxietyLinks.map((row) => row.normalized)).toContain('care');
  });

  test('topic names are full-text searchable and normalized', () => {
    const rows = db
      .prepare(`SELECT t.normalized FROM topics_fts JOIN topics t ON t.id = topics_fts.rowid WHERE topics_fts MATCH '"worry"'`)
      .all() as { normalized: string }[];
    expect(rows.map((row) => row.normalized)).toContain('worry');
    expect(count("SELECT COUNT(*) AS n FROM topics WHERE normalized <> lower(normalized) OR normalized GLOB '*  *'")).toBe(0);
  });
});

describe("Easton's Bible Dictionary", () => {
  test('has the full set of entries as plain text', () => {
    expect(count('SELECT COUNT(*) AS n FROM dictionary')).toBeGreaterThan(3_900);
    expect(count("SELECT COUNT(*) AS n FROM dictionary WHERE definition GLOB '*<*>*' OR definition = ''")).toBe(0);
  });

  test('known entries read as expected', () => {
    const grace = db.prepare("SELECT term, definition FROM dictionary WHERE normalized = 'grace'").get() as {
      term: string;
      definition: string;
    };
    expect(grace.term).toBe('Grace');
    expect(grace.definition).toContain('God’s forgiving mercy (Rom. 11:6; Eph. 2:5)');
    const supper = db.prepare("SELECT term FROM dictionary WHERE normalized = 'lords supper'").get() as { term: string };
    expect(supper.term).toBe('Lord’s Supper');
  });

  test('terms and definitions are full-text searchable', () => {
    const rows = db
      .prepare(`SELECT d.normalized FROM dictionary_fts JOIN dictionary d ON d.id = dictionary_fts.rowid WHERE dictionary_fts MATCH 'term:"atonement"'`)
      .all() as { normalized: string }[];
    expect(rows.map((row) => row.normalized)).toContain('atonement');
  });
});
