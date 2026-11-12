#!/usr/bin/env node
/**
 * Builds the bundled, read-only Bible database (assets/bible/bible.db) and the generated
 * verse-count table (src/features/bible/data/verse-counts.ts).
 *
 * Sources (see docs/legal/bible-sources.md):
 *   - World English Bible, USFM, public domain — eBible.org
 *   - Cross references — OpenBible.info, CC-BY
 *   - Topical data — OpenBible.info, CC-BY
 *   - Nave's Topical Bible and Easton's Bible Dictionary (1897), public domain — CrossWire SWORD modules
 *
 * Usage:
 *   node scripts/bible/build-bible-db.mjs [--download] [--sources <dir>] [--out <file>] [--max-refs <n>]
 *
 * Downloads go into a dedicated directory OUTSIDE the repository (default: <os tmp>/faithscroll-bible).
 * Archives are read in memory and treated as untrusted data; nothing in them is executed.
 */
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { BOOKS } from '../../src/features/bible/books.ts';
import { parseCrossReferences } from './lib/cross-references.mjs';
import { parseEastonEntries } from './lib/dictionary.mjs';
import { createStudySchema, insertStudyData } from './lib/study-db.mjs';
import { readZldModule, zldFilesFrom } from './lib/sword-zld.mjs';
import { addNaveTopics, addOpenBibleTopics, toTopicRows } from './lib/topics.mjs';
import { parseUsfmBook } from './lib/usfm.mjs';
import { listEntries, readEntry, readTextEntries } from './lib/zip.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB_URL = 'https://ebible.org/Scriptures/eng-web_usfm.zip';
const WEB_ZIP = 'eng-web_usfm.zip';
const XREF_URL = 'https://a.openbible.info/data/cross-references.zip';
const XREF_ZIP = 'cross-references.zip';
const TOPICS_URL = 'https://a.openbible.info/data/topic-scores.zip';
const TOPICS_ZIP = 'topic-scores.zip';
const NAVE_URL = 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Nave.zip';
const NAVE_ZIP = 'Nave.zip';
const EASTON_URL = 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Easton.zip';
const EASTON_ZIP = 'Easton.zip';
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const SCHEMA_VERSION = 2;
const DEFAULT_MAX_REFS = 15;

function parseArgs(argv) {
  const args = {
    download: false,
    sources: path.join(os.tmpdir(), 'faithscroll-bible'),
    out: path.join(REPO_ROOT, 'assets', 'bible', 'bible.db'),
    countsOut: path.join(REPO_ROOT, 'src', 'features', 'bible', 'data', 'verse-counts.ts'),
    maxRefs: DEFAULT_MAX_REFS,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--download') args.download = true;
    else if (flag === '--sources') args.sources = path.resolve(argv[++index]);
    else if (flag === '--out') args.out = path.resolve(argv[++index]);
    else if (flag === '--max-refs') args.maxRefs = Number.parseInt(argv[++index], 10);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!Number.isInteger(args.maxRefs) || args.maxRefs < 1) throw new Error('--max-refs must be a positive integer');
  return args;
}

async function download(url, destination) {
  const response = await fetch(url, { headers: { 'User-Agent': 'faithscroll-bible-build' } });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) throw new Error(`Download too large: ${url}`);
  writeFileSync(destination, bytes);
  process.stdout.write(`downloaded ${url} (${bytes.length} bytes)\n`);
}

async function ensureSources({ sources, download: shouldDownload }) {
  const relative = path.relative(REPO_ROOT, sources);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new Error('Source directory must be outside the repository');
  }
  mkdirSync(sources, { recursive: true });
  const files = {
    webZip: [WEB_URL, WEB_ZIP],
    xrefZip: [XREF_URL, XREF_ZIP],
    topicsZip: [TOPICS_URL, TOPICS_ZIP],
    naveZip: [NAVE_URL, NAVE_ZIP],
    eastonZip: [EASTON_URL, EASTON_ZIP],
  };
  const result = {};
  for (const [key, [url, name]] of Object.entries(files)) {
    const file = path.join(sources, name);
    if (shouldDownload || !existsSync(file)) await download(url, file);
    result[key] = file;
  }
  return result;
}

/** Parses the 66 Protestant books (deuterocanon, glossary and front matter are skipped). */
function readBible(webZip) {
  const codes = new Set(BOOKS.map((book) => book.code));
  const files = readTextEntries(readFileSync(webZip), (name) => /^\d+-[0-9A-Z]{3}.*\.usfm$/i.test(name));
  const byCode = new Map();
  const warnings = [];
  for (const [name, source] of files) {
    const code = name.replace(/^\d+-/, '').slice(0, 3).toUpperCase();
    if (!codes.has(code)) continue;
    const parsed = parseUsfmBook(source);
    if (parsed.code !== code) throw new Error(`${name}: \\id ${parsed.code} does not match file name`);
    byCode.set(code, parsed.verses);
    warnings.push(...parsed.warnings);
  }
  const missing = BOOKS.filter((book) => !byCode.has(book.code)).map((book) => book.code);
  if (missing.length > 0) throw new Error(`Missing books in source: ${missing.join(', ')}`);
  return { byCode, warnings };
}

/**
 * Verses whose only content is a footnote (e.g. Acts 8:37 "TR adds …") are omitted, as in most
 * modern editions; the verse number is simply skipped.
 */
function toRows(byCode) {
  const rows = [];
  for (const book of BOOKS) {
    for (const verse of byCode.get(book.code)) {
      if (!verse.text) continue;
      rows.push({
        id: book.id * 1_000_000 + verse.chapter * 1_000 + verse.verse,
        bookId: book.id,
        ...verse,
      });
    }
  }
  return rows;
}

/** verseCounts[bookIndex][chapterIndex] = highest verse number; also reports gaps and chapter mismatches. */
function computeVerseCounts(rows) {
  const counts = BOOKS.map(() => []);
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`Duplicate verse ${row.id}`);
    seen.add(row.id);
    const chapters = counts[row.bookId - 1];
    chapters[row.chapter - 1] = Math.max(chapters[row.chapter - 1] ?? 0, row.verse);
  }
  const problems = [];
  const omitted = [];
  BOOKS.forEach((book, index) => {
    const chapters = counts[index];
    if (chapters.length !== book.chapters) {
      problems.push(`${book.code}: ${chapters.length} chapters in source, ${book.chapters} in books.ts`);
    }
    chapters.forEach((last, chapterIndex) => {
      for (let verse = 1; verse <= (last ?? 0); verse += 1) {
        const id = book.id * 1_000_000 + (chapterIndex + 1) * 1_000 + verse;
        if (seen.has(id)) continue;
        omitted.push(id);
        problems.push(`${book.code} ${chapterIndex + 1}:${verse} is not in the text (verse number skipped)`);
      }
    });
  });
  return { counts: counts.map((chapters) => Array.from(chapters, (value) => value ?? 0)), omitted, problems };
}

function writeVerseCounts(file, counts, omitted) {
  const lines = counts.map((chapters, index) => `  /* ${BOOKS[index].code} */ [${chapters.join(', ')}],`);
  const content = [
    '/**',
    ' * GENERATED by scripts/bible/build-bible-db.mjs from the World English Bible (public domain).',
    ' * Do not edit by hand. VERSE_COUNTS[bookId - 1][chapter - 1] = highest verse number in that chapter.',
    ' */',
    'export const VERSE_COUNTS: readonly (readonly number[])[] = [',
    ...lines,
    '];',
    '',
    '/** Verse numbers inside a chapter that this translation leaves out (text only in a footnote). */',
    `export const OMITTED_VERSE_IDS: readonly number[] = [${omitted.join(', ')}];`,
    '',
  ].join('\n');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function createSchema(db) {
  db.exec(`
    PRAGMA page_size = 4096;
    PRAGMA journal_mode = DELETE;
    CREATE TABLE verses (
      id INTEGER PRIMARY KEY, -- book * 1e6 + chapter * 1e3 + verse
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL,
      heading TEXT,
      paragraph_start INTEGER NOT NULL DEFAULT 0,
      poetry INTEGER NOT NULL DEFAULT 0
    );
    CREATE VIRTUAL TABLE verses_fts USING fts5(
      text,
      content = 'verses',
      content_rowid = 'id',
      tokenize = 'porter unicode61 remove_diacritics 2'
    );
    CREATE TABLE cross_references (
      from_verse_id INTEGER NOT NULL,
      to_start_verse_id INTEGER NOT NULL,
      to_end_verse_id INTEGER NOT NULL,
      votes INTEGER NOT NULL,
      PRIMARY KEY (from_verse_id, to_start_verse_id, to_end_verse_id)
    ) WITHOUT ROWID;
    CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
  `);
}

function insertAll(db, rows, references, metadata) {
  const insertVerse = db.prepare(
    `INSERT INTO verses (id, book_id, chapter, verse, text, heading, paragraph_start, poetry)
     VALUES (@id, @bookId, @chapter, @verse, @text, @heading, @paragraphStart, @poetry)`,
  );
  const insertReference = db.prepare(
    `INSERT INTO cross_references (from_verse_id, to_start_verse_id, to_end_verse_id, votes)
     VALUES (@from, @toStart, @toEnd, @votes)`,
  );
  const insertMetadata = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)');
  db.transaction(() => {
    for (const row of rows) {
      insertVerse.run({ ...row, paragraphStart: row.paragraphStart ? 1 : 0, poetry: row.poetry ? 1 : 0 });
    }
    for (const reference of references) insertReference.run(reference);
    for (const [key, value] of Object.entries(metadata)) insertMetadata.run(key, String(value));
  })();
  db.exec(`
    INSERT INTO verses_fts (verses_fts) VALUES ('rebuild');
    INSERT INTO verses_fts (verses_fts) VALUES ('optimize');
  `);
  db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

/** Reads a CrossWire rawzip module (zLD dictionary) from a downloaded archive. */
function readSwordModule(zipFile) {
  const buffer = readFileSync(zipFile);
  const files = new Map(
    listEntries(buffer)
      .filter((entry) => entry.name.startsWith('modules/') && !entry.name.endsWith('/'))
      .map((entry) => [entry.name, readEntry(buffer, entry)]),
  );
  return readZldModule(zldFilesFrom(files));
}

function buildStudyData({ topicsZip, naveZip, eastonZip }, context) {
  const topics = new Map();
  const topicText = [...readTextEntries(readFileSync(topicsZip), (name) => name.endsWith('.txt')).values()].join('\n');
  const openBibleStats = addOpenBibleTopics(topics, topicText, context);
  const naveStats = addNaveTopics(topics, readSwordModule(naveZip), context);
  const dictionary = parseEastonEntries(readSwordModule(eastonZip));
  return { topics: toTopicRows(topics), dictionary, stats: { openBible: openBibleStats, nave: naveStats, easton: dictionary.stats } };
}

function buildDatabase(out, rows, references, study, metadata) {
  mkdirSync(path.dirname(out), { recursive: true });
  const temporary = `${out}.tmp`;
  rmSync(temporary, { force: true });
  const db = new Database(temporary);
  try {
    createSchema(db);
    createStudySchema(db);
    insertAll(db, rows, references, metadata);
    insertStudyData(db, study.topics, study.dictionary.rows);
    db.exec('ANALYZE; VACUUM;');
  } finally {
    db.close();
  }
  renameSync(temporary, out);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sources = await ensureSources(args);
  const { webZip, xrefZip } = sources;

  const { byCode, warnings } = readBible(webZip);
  const rows = toRows(byCode);
  const { counts, omitted, problems } = computeVerseCounts(rows);
  for (const warning of [...warnings, ...problems]) process.stdout.write(`warning: ${warning}\n`);

  const osisToBookId = new Map(BOOKS.map((book) => [book.shortName.replace(/\s+/g, ''), book.id]));
  const verseIds = new Set(rows.map((row) => row.id));
  const xrefText = [...readTextEntries(readFileSync(xrefZip), (name) => name.endsWith('.txt')).values()].join('\n');
  const { references, stats } = parseCrossReferences(xrefText, {
    osisToBookId,
    verseExists: (id) => verseIds.has(id),
    maxPerVerse: args.maxRefs,
  });
  const study = buildStudyData(sources, {
    osisToBookId,
    lastVerse: (bookId, chapter) => counts[bookId - 1]?.[chapter - 1] ?? 0,
    verseExists: (id) => verseIds.has(id),
  });

  const metadata = {
    schema_version: SCHEMA_VERSION,
    translation_id: 'WEB',
    translation_name: 'World English Bible',
    translation_language: 'en',
    translation_license: 'Public Domain',
    translation_attribution: 'The World English Bible is in the public domain. "World English Bible" is a trademark of eBible.org.',
    translation_source_url: WEB_URL,
    cross_references_license: 'CC-BY',
    cross_references_attribution: 'Cross references from OpenBible.info (https://www.openbible.info/labs/cross-references/), licensed CC-BY.',
    cross_references_source_url: XREF_URL,
    cross_references_max_per_verse: args.maxRefs,
    topics_license: 'CC-BY (OpenBible.info topical data); Public Domain (Nave’s Topical Bible)',
    topics_attribution:
      'Topical data from OpenBible.info (https://www.openbible.info/topics/), licensed CC BY 4.0, merged with Nave’s Topical Bible (public domain).',
    topics_source_url: `${TOPICS_URL} ${NAVE_URL}`,
    topic_count: study.topics.topicRows.length,
    dictionary_name: "Easton's Bible Dictionary (1897)",
    dictionary_license: 'Public Domain',
    dictionary_attribution: "Easton's Bible Dictionary, M. G. Easton, 1897 (public domain), via the CrossWire Bible Society.",
    dictionary_source_url: EASTON_URL,
    dictionary_entry_count: study.dictionary.rows.length,
    verse_count: rows.length,
    built_at: new Date().toISOString(),
  };

  buildDatabase(args.out, rows, references, study, metadata);
  writeVerseCounts(args.countsOut, counts, omitted);

  const size = statSync(args.out).size;
  process.stdout.write(
    [
      `verses: ${rows.length}`,
      `cross references: ${JSON.stringify(stats)}`,
      `topics: ${study.topics.topicRows.length} (${study.topics.verseRows.length} verse links) ${JSON.stringify(study.stats.openBible)} ${JSON.stringify(study.stats.nave)}`,
      `dictionary: ${study.dictionary.rows.length} entries ${JSON.stringify(study.stats.easton)}`,
      `database: ${args.out} (${(size / 1024 / 1024).toFixed(2)} MB)`,
      `verse counts: ${args.countsOut}`,
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  process.stderr.write(`build-bible-db failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
