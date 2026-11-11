import { BOOKS, booksInTestament, getBook, getBookByCode, nextChapter, previousChapter } from '@/features/bible/books';
import { fromVerseId, idsToRange, rangeContains, toVerseId } from '@/features/bible/verse-id';

describe('BOOKS', () => {
  test('has 66 books, 39 OT and 27 NT, 1189 chapters', () => {
    expect(BOOKS).toHaveLength(66);
    expect(booksInTestament('OT')).toHaveLength(39);
    expect(booksInTestament('NT')).toHaveLength(27);
    expect(BOOKS.reduce((sum, b) => sum + b.chapters, 0)).toBe(1189);
  });

  test('ids are 1..66 in order and codes are unique', () => {
    expect(BOOKS.map((b) => b.id)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
    expect(new Set(BOOKS.map((b) => b.code)).size).toBe(66);
  });

  test('looks up by id and code', () => {
    expect(getBook(40)?.name).toBe('Matthew');
    expect(getBookByCode('rom')?.id).toBe(45);
    expect(getBook(67)).toBeUndefined();
  });
});

describe('chapter navigation', () => {
  test('moves within a book', () => {
    expect(nextChapter({ bookId: 43, chapter: 3 })).toEqual({ bookId: 43, chapter: 4 });
    expect(previousChapter({ bookId: 43, chapter: 3 })).toEqual({ bookId: 43, chapter: 2 });
  });

  test('crosses book boundaries', () => {
    expect(nextChapter({ bookId: 1, chapter: 50 })).toEqual({ bookId: 2, chapter: 1 });
    expect(previousChapter({ bookId: 2, chapter: 1 })).toEqual({ bookId: 1, chapter: 50 });
  });

  test('stops at the ends of the canon', () => {
    expect(previousChapter({ bookId: 1, chapter: 1 })).toBeNull();
    expect(nextChapter({ bookId: 66, chapter: 22 })).toBeNull();
  });
});

describe('verse ids', () => {
  test('round-trips Romans 8:28', () => {
    const id = toVerseId({ bookId: 45, chapter: 8, verse: 28 });
    expect(id).toBe(45_008_028);
    expect(fromVerseId(id)).toEqual({ bookId: 45, chapter: 8, verse: 28 });
  });

  test('Psalm 119:176 fits without collision', () => {
    expect(fromVerseId(toVerseId({ bookId: 19, chapter: 119, verse: 176 }))).toEqual({ bookId: 19, chapter: 119, verse: 176 });
  });

  test('rangeContains is inclusive', () => {
    const range = idsToRange(40_018_021, 40_018_035);
    expect(rangeContains(range, 40_018_021)).toBe(true);
    expect(rangeContains(range, 40_018_035)).toBe(true);
    expect(rangeContains(range, 40_018_036)).toBe(false);
  });
});
