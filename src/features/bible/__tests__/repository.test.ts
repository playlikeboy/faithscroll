/**
 * Runs the real repository against the bundled assets/bible/bible.db through better-sqlite3.
 */
import { prepareBibleDatabase } from '@/features/bible/db/connection';
import { toFtsQuery } from '@/features/bible/db/fts-query';
import { installBundledBibleForTests } from '@/features/bible/db/testing/node-executor';
import {
  getChapter,
  getCrossReferences,
  getVerse,
  getVerseCount,
  getVerses,
  searchBible,
} from '@/features/bible/repository';
import { idsToRange } from '@/features/bible/verse-id';

let restore: () => void;

beforeAll(() => {
  restore = installBundledBibleForTests();
});

afterAll(() => {
  restore();
});

describe('getChapter', () => {
  test('returns every verse of a chapter in order', async () => {
    const verses = await getChapter(43, 3);
    expect(verses).toHaveLength(36);
    expect(verses.map((verse) => verse.verse)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
    expect(verses[15]).toMatchObject({ id: 43_003_016, bookId: 43, chapter: 3, verse: 16, poetry: false });
    expect(verses[0].paragraphStart).toBe(true);
  });

  test('carries headings and poetry flags', async () => {
    const [first, second] = await getChapter(19, 23);
    expect(first).toMatchObject({ heading: 'A Psalm by David.', poetry: true, paragraphStart: true });
    expect(second).toMatchObject({ heading: null, poetry: true });
  });

  test('skips verses the translation omits', async () => {
    const verses = await getChapter(44, 8);
    expect(verses.map((verse) => verse.verse)).not.toContain(37);
    expect(verses).toHaveLength(39);
  });

  test('returns [] for chapters that do not exist or invalid input', async () => {
    expect(await getChapter(43, 22)).toEqual([]);
    expect(await getChapter(0, 1)).toEqual([]);
    expect(await getChapter(1.5, 1)).toEqual([]);
  });
});

describe('getVerses / getVerse', () => {
  test('returns ranges across chapters', async () => {
    const verses = await getVerses(idsToRange(19_023_005, 19_024_002));
    expect(verses.map((verse) => verse.id)).toEqual([19_023_005, 19_023_006, 19_024_001, 19_024_002]);
  });

  test('returns [] for inverted ranges', async () => {
    expect(await getVerses(idsToRange(43_003_017, 43_003_016))).toEqual([]);
  });

  test('returns a single verse or null', async () => {
    expect((await getVerse(43_011_035))?.text).toBe('Jesus wept.');
    expect(await getVerse(44_008_037)).toBeNull();
    expect(await getVerse(-1)).toBeNull();
  });
});

describe('searchBible', () => {
  test('returns [] for empty or punctuation-only queries', async () => {
    expect(await searchBible('')).toEqual([]);
    expect(await searchBible('   ')).toEqual([]);
    expect(await searchBible('*** --- ()')).toEqual([]);
  });

  test('marks matches in the snippet', async () => {
    const results = await searchBible('love', { limit: 5 });
    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.snippet).toMatch(/«[^»]+»/);
      expect(result.snippet.replace(/[«»]/g, '')).toBe(result.verse.text);
    }
  });

  test('matches quoted phrases with straight or curly quotes', async () => {
    const works = await searchBible('"faith without works"');
    expect(works.map((result) => result.verse.id)).toContain(59_002_018);
    expect(works.find((result) => result.verse.id === 59_002_018)?.snippet).toContain('«faith without works»');
    const enemies = await searchBible('“love your enemies”');
    expect(enemies.map((result) => result.verse.id)).toEqual(expect.arrayContaining([40_005_044, 42_006_027]));
  });

  test('stems words', async () => {
    const results = await searchBible('forgiving trespasses');
    expect(results.map((result) => result.verse.id)).toContain(40_006_014);
  });

  test('paginates in canonical order', async () => {
    const page1 = await searchBible('peace', { limit: 10 });
    const page2 = await searchBible('peace', { limit: 10, offset: 10 });
    const ids = [...page1, ...page2].map((result) => result.verse.id);
    expect(ids).toHaveLength(20);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    expect(new Set(ids).size).toBe(20);
  });

  test('filters by book and testament', async () => {
    const john = await searchBible('light', { bookId: 43, limit: 100 });
    expect(john.length).toBeGreaterThan(0);
    expect(john.every((result) => result.verse.bookId === 43)).toBe(true);
    const nt = await searchBible('shepherd', { testament: 'NT', limit: 100 });
    expect(nt.every((result) => result.verse.bookId >= 40)).toBe(true);
    const ot = await searchBible('shepherd', { testament: 'OT', limit: 100 });
    expect(ot.every((result) => result.verse.bookId <= 39)).toBe(true);
    expect(await searchBible('shepherd', { testament: 'NT', bookId: 19 })).toEqual([]);
  });

  test.each([
    ['love AND'],
    ['NEAR(love'],
    ['"unclosed phrase'],
    ['col:umn'],
    ['((('],
    ['-love'],
    ["doesn't"],
    ['OR'],
    ['^start'],
    ['{a b}'],
    ['love*'],
    ['"" ""'],
  ])('never throws on FTS syntax in %p', async (query) => {
    await expect(searchBible(query)).resolves.toEqual(expect.any(Array));
  });

  test('treats operators as words', async () => {
    const results = await searchBible('doesn’t', { limit: 3 });
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('toFtsQuery', () => {
  test('quotes every term and phrase', () => {
    expect(toFtsQuery('love your "enemies today"')).toBe('"love" "your" "enemies today"');
    expect(toFtsQuery('say "hi')).toBe('"say" "hi"');
    expect(toFtsQuery('a"b')).toBe('"a" "b"');
    expect(toFtsQuery('  ')).toBeNull();
  });

  test('limits the number of terms', () => {
    const query = toFtsQuery(Array.from({ length: 40 }, (_, i) => `w${i}`).join(' '));
    expect(query?.split(' ')).toHaveLength(16);
  });
});

describe('getCrossReferences', () => {
  test('returns the most-voted related passages first', async () => {
    const related = await getCrossReferences(43_003_016);
    expect(related.length).toBeGreaterThan(3);
    expect(related[0]).toEqual(idsToRange(45_005_008));
    expect(await getCrossReferences(43_003_016, 3)).toHaveLength(3);
  });

  test('returns [] for unknown verses', async () => {
    expect(await getCrossReferences(99_001_001)).toEqual([]);
    expect(await getCrossReferences(0)).toEqual([]);
  });
});

describe('getVerseCount', () => {
  test('reads the generated table', () => {
    expect(getVerseCount(43, 3)).toBe(36);
    expect(getVerseCount(19, 119)).toBe(176);
    expect(getVerseCount(66, 23)).toBe(0);
    expect(getVerseCount(0, 0)).toBe(0);
  });
});

describe('prepareBibleDatabase', () => {
  test('resolves once the database answers', async () => {
    await expect(prepareBibleDatabase()).resolves.toBeUndefined();
  });
});
