import { buildChapterBlocks, findBlockIndex, MAX_VERSES_PER_BLOCK } from '@/features/bible/reader/paragraphs';
import { chapterTitle, rangeLabel } from '@/features/bible/reader/format';
import { isValidVerseId, parseReaderParams, parseVerseRangeParams } from '@/features/bible/reader/params';
import { bibleRoutes } from '@/features/bible/reader/routes';
import type { Verse } from '@/features/bible/types';
import { idsToRange } from '@/features/bible/verse-id';

jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));

function verse(n: number, extra: Partial<Verse> = {}): Verse {
  return {
    id: 19_023_000 + n,
    bookId: 19,
    chapter: 23,
    verse: n,
    text: `Line ${n}`,
    heading: null,
    paragraphStart: false,
    poetry: false,
    ...extra,
  };
}

describe('buildChapterBlocks', () => {
  test('starts blocks at headings, paragraph starts and poetry changes', () => {
    const blocks = buildChapterBlocks([
      verse(1, { heading: 'A Psalm of David' }),
      verse(2),
      verse(3, { paragraphStart: true }),
      verse(4, { poetry: true }),
      verse(5, { poetry: true }),
    ]);

    expect(blocks.map((b) => b.verses.map((v) => v.verse))).toEqual([[1, 2], [3], [4, 5]]);
    expect(blocks[0].heading).toBe('A Psalm of David');
    expect(blocks[1].heading).toBeNull();
    expect(blocks[2].poetry).toBe(true);
    expect(new Set(blocks.map((b) => b.key)).size).toBe(3);
  });

  test('splits very long paragraphs to keep the list virtualised', () => {
    const verses = Array.from({ length: 30 }, (_, i) => verse(i + 1));
    const blocks = buildChapterBlocks(verses);
    expect(blocks.every((b) => b.verses.length <= MAX_VERSES_PER_BLOCK)).toBe(true);
    expect(blocks.flatMap((b) => b.verses)).toHaveLength(30);
  });

  test('returns no blocks for an empty chapter and finds verse blocks', () => {
    expect(buildChapterBlocks([])).toEqual([]);
    const blocks = buildChapterBlocks([verse(1), verse(2, { paragraphStart: true })]);
    expect(findBlockIndex(blocks, 19_023_002)).toBe(1);
    expect(findBlockIndex(blocks, 19_023_009)).toBe(-1);
  });
});

describe('route params', () => {
  test('parses a valid reader location with an optional verse', () => {
    expect(parseReaderParams({ bookId: '43', chapter: '3' })).toEqual({ bookId: 43, chapter: 3 });
    expect(parseReaderParams({ bookId: ['43'], chapter: '3', verse: '16' })).toEqual({ bookId: 43, chapter: 3, verse: 16 });
  });

  test('rejects unknown books, chapters and junk', () => {
    expect(parseReaderParams({ bookId: '67', chapter: '1' })).toBeNull();
    expect(parseReaderParams({ bookId: '43', chapter: '22' })).toBeNull();
    expect(parseReaderParams({ bookId: 'john', chapter: '3' })).toBeNull();
    expect(parseReaderParams({ bookId: '43', chapter: '3', verse: '-1' })).toBeNull();
  });

  test('parses verse ranges, defaulting and normalising the end', () => {
    expect(parseVerseRangeParams({ start: '45008028' })).toEqual({
      startVerseId: 45_008_028,
      endVerseId: 45_008_028,
      range: idsToRange(45_008_028),
    });
    expect(parseVerseRangeParams({ start: '45008030', end: '45008028' })?.startVerseId).toBe(45_008_028);
    expect(parseVerseRangeParams({ start: '99001001' })).toBeNull();
    expect(parseVerseRangeParams({})).toBeNull();
  });

  test('validates verse ids', () => {
    expect(isValidVerseId(43_003_016)).toBe(true);
    expect(isValidVerseId(43_003_000)).toBe(false);
    expect(isValidVerseId(43_099_001)).toBe(false);
    expect(isValidVerseId(1.5)).toBe(false);
  });
});

describe('formatting', () => {
  test('chapter titles use "Psalm" for single psalms', () => {
    expect(chapterTitle(19, 23)).toBe('Psalm 23');
    expect(chapterTitle(43, 3)).toBe('John 3');
  });

  test('falls back to a local reference format', () => {
    expect(rangeLabel(idsToRange(45_008_028))).toBe('Romans 8:28');
    expect(rangeLabel(idsToRange(45_008_028, 45_008_030))).toBe('Romans 8:28–30');
    expect(rangeLabel(idsToRange(43_003_036, 43_004_002))).toBe('John 3:36–4:2');
    expect(rangeLabel(idsToRange(1_050_026, 2_001_001))).toBe('Genesis 50:26–Exodus 1:1');
  });
});

describe('routes', () => {
  test('builds reader, sheet and cross-agent hrefs', () => {
    expect(bibleRoutes.reader(43, 3)).toBe('/bible/read/43/3');
    expect(bibleRoutes.reader(43, 3, 16)).toBe('/bible/read/43/3?verse=16');
    expect(bibleRoutes.verseActions(1, 2)).toBe('/bible/verse-actions?start=1&end=2');
    expect(bibleRoutes.study(5)).toBe('/bible/study/5?end=5');
    expect(bibleRoutes.reflection(1, 2)).toBe('/journal/new?type=bible_study&start=1&end=2');
    expect(bibleRoutes.books({ replaceReader: true })).toBe('/bible/books?replace=1');
    expect(bibleRoutes.books()).toBe('/bible/books');
    expect(bibleRoutes.passagePicker({ requestId: 'r1', title: 'Main passage' })).toBe(
      '/bible/passage-picker?requestId=r1&title=Main%20passage',
    );
  });
});
