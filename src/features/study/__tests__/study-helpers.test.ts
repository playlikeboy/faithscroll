import type { Verse } from '@/features/bible/types';
import { surroundingContext } from '@/features/study/context';
import { REFLECTION_QUESTIONS, reflectionQuestionsFor } from '@/features/study/reflection-questions';

function chapter(bookId: number, chapterNumber: number, count: number): Verse[] {
  return Array.from({ length: count }, (_, i) => ({
    id: bookId * 1_000_000 + chapterNumber * 1_000 + i + 1,
    bookId,
    chapter: chapterNumber,
    verse: i + 1,
    text: `v${i + 1}`,
    heading: null,
    paragraphStart: false,
    poetry: false,
  }));
}

describe('surroundingContext', () => {
  const romans8 = chapter(45, 8, 39);

  test('takes up to three verses either side', () => {
    const { before, after } = surroundingContext(romans8, romans8, 45_008_028, 45_008_028);
    expect(before.map((v) => v.verse)).toEqual([25, 26, 27]);
    expect(after.map((v) => v.verse)).toEqual([29, 30, 31]);
  });

  test('clips at chapter edges', () => {
    expect(surroundingContext(romans8, romans8, 45_008_001, 45_008_002).before).toEqual([]);
    expect(surroundingContext(romans8, romans8, 45_008_038, 45_008_039).after).toEqual([]);
  });

  test('uses the end chapter for passages that cross chapters', () => {
    const romans9 = chapter(45, 9, 33);
    const { before, after } = surroundingContext(romans8, romans9, 45_008_039, 45_009_001, 2);
    expect(before.map((v) => v.verse)).toEqual([37, 38]);
    expect(after.map((v) => v.id)).toEqual([45_009_002, 45_009_003]);
  });

  test('returns nothing when verses are not loaded', () => {
    expect(surroundingContext([], [], 45_008_028, 45_008_028)).toEqual({ before: [], after: [] });
  });
});

describe('reflectionQuestionsFor', () => {
  test('is stable per passage and varies between passages', () => {
    expect(reflectionQuestionsFor(45_008_028)).toEqual(reflectionQuestionsFor(45_008_028));
    expect(reflectionQuestionsFor(45_008_028)).toHaveLength(4);
    expect(new Set([1, 2, 3, 4, 5].map((n) => reflectionQuestionsFor(n)[0])).size).toBeGreaterThan(1);
  });

  test('clamps the count', () => {
    expect(reflectionQuestionsFor(1, 100)).toHaveLength(REFLECTION_QUESTIONS.length);
    expect(reflectionQuestionsFor(1, -2)).toEqual([]);
  });
});
