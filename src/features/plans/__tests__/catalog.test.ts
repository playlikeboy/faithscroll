import { BOOKS, getBook, getBookByCode } from '@/features/bible/books';

import { allChapters, getPlan, getPlanDay, READING_PLANS, spreadOverDays } from '../catalog';
import { formatDayReadings, formatPlanReading, readingHref } from '../format';
import type { PlanReading } from '../types';

/** Verse counts (WEB / standard English versification) for chapters used by curated plans. */
const CURATED_VERSE_COUNTS: Record<string, number> = {
  'PSA 100': 5,
  'PSA 103': 22,
  '1TH 5': 28,
  'PHP 4': 23,
  'COL 3': 25,
  'LUK 17': 37,
  'PSA 136': 26,
  'LAM 3': 66,
  'ISA 40': 31,
  'PSA 42': 11,
  'JER 29': 32,
  'ROM 8': 39,
  '1PE 1': 25,
  'REV 21': 27,
};

function key(reading: PlanReading): string {
  return `${getBook(reading.bookId)?.code} ${reading.chapter}`;
}

describe('reading plan catalog', () => {
  it('has the five plans with unique ids', () => {
    expect(READING_PLANS.map((plan) => plan.id)).toEqual(['john-21', 'psalms-30', 'bible-year', 'gratitude-7', 'hope-7']);
  });

  it.each(READING_PLANS.map((plan) => [plan.id, plan] as const))('%s only references real books and chapters', (_id, plan) => {
    plan.days.forEach((day, index) => {
      expect(day.day).toBe(index + 1);
      expect(day.readings.length).toBeGreaterThan(0);
      for (const reading of day.readings) {
        const book = getBook(reading.bookId);
        expect(book).toBeDefined();
        expect(reading.chapter).toBeGreaterThanOrEqual(1);
        expect(reading.chapter).toBeLessThanOrEqual(book?.chapters ?? 0);
        if (reading.startVerse !== undefined) {
          expect(reading.startVerse).toBeGreaterThanOrEqual(1);
          expect(reading.endVerse ?? reading.startVerse).toBeGreaterThanOrEqual(reading.startVerse);
        }
      }
    });
  });

  it('reads John one chapter a day for 21 days', () => {
    const plan = getPlan('john-21');
    const john = getBookByCode('JHN');
    expect(plan?.days).toHaveLength(21);
    expect(plan?.days.flatMap((day) => day.readings)).toEqual(Array.from({ length: 21 }, (_, i) => ({ bookId: john?.id, chapter: i + 1 })));
  });

  it('reads all 150 psalms, five a day for 30 days', () => {
    const plan = getPlan('psalms-30');
    expect(plan?.days).toHaveLength(30);
    expect(plan?.days.every((day) => day.readings.length === 5)).toBe(true);
    expect(plan?.days.flatMap((day) => day.readings.map((r) => r.chapter))).toEqual(Array.from({ length: 150 }, (_, i) => i + 1));
  });

  it('covers all 1,189 chapters exactly once over 365 days, in canonical order', () => {
    const plan = getPlan('bible-year');
    expect(BOOKS.reduce((sum, book) => sum + book.chapters, 0)).toBe(1189);
    expect(plan?.days).toHaveLength(365);
    const readings = plan?.days.flatMap((day) => day.readings) ?? [];
    expect(readings).toEqual(allChapters());
    expect(new Set(readings.map(key)).size).toBe(1189);
    const sizes = plan?.days.map((day) => day.readings.length) ?? [];
    expect(Math.min(...sizes)).toBe(3);
    expect(Math.max(...sizes)).toBe(4);
  });

  it.each(['gratitude-7', 'hope-7'])('%s has seven themed days with valid verse ranges', (id) => {
    const plan = getPlan(id);
    expect(plan?.days).toHaveLength(7);
    for (const day of plan?.days ?? []) {
      expect(day.theme).toBeTruthy();
      for (const reading of day.readings) {
        const verseCount = CURATED_VERSE_COUNTS[key(reading)];
        expect(verseCount).toBeDefined();
        expect(reading.endVerse ?? verseCount).toBeLessThanOrEqual(verseCount);
      }
    }
  });

  it('looks up plans and days', () => {
    const plan = getPlan('hope-7');
    expect(plan && getPlanDay(plan, 1)?.theme).toBe('New every morning');
    expect(plan && getPlanDay(plan, 8)).toBeUndefined();
    expect(getPlan('missing')).toBeUndefined();
  });

  it('spreads readings evenly even when they do not divide', () => {
    const readings = allChapters().slice(0, 10);
    const days = spreadOverDays(readings, 3);
    expect(days.map((day) => day.readings.length)).toEqual([3, 3, 4]);
  });
});

describe('plan formatting', () => {
  const john = getBookByCode('JHN')?.id ?? 0;
  const psalms = getBookByCode('PSA')?.id ?? 0;
  const genesis = getBookByCode('GEN')?.id ?? 0;
  const exodus = getBookByCode('EXO')?.id ?? 0;

  it('formats single readings', () => {
    expect(formatPlanReading({ bookId: john, chapter: 3 })).toBe('John 3');
    expect(formatPlanReading({ bookId: psalms, chapter: 103, startVerse: 1, endVerse: 5 })).toBe('Psalm 103:1–5');
    expect(formatPlanReading({ bookId: john, chapter: 3, startVerse: 16 })).toBe('John 3:16');
    expect(formatPlanReading({ bookId: 99, chapter: 1 })).toBe('Unknown book 1');
  });

  it('merges consecutive chapters across a day', () => {
    expect(formatDayReadings([1, 2, 3].map((chapter) => ({ bookId: psalms, chapter })))).toBe('Psalms 1–3');
    expect(
      formatDayReadings([
        { bookId: genesis, chapter: 50 },
        { bookId: exodus, chapter: 1 },
        { bookId: exodus, chapter: 2 },
      ]),
    ).toBe('Genesis 50, Exodus 1–2');
    expect(formatDayReadings([{ bookId: psalms, chapter: 42 }, { bookId: john, chapter: 1, startVerse: 1, endVerse: 5 }])).toBe(
      'Psalm 42, John 1:1–5',
    );
  });

  it('builds reader links', () => {
    expect(readingHref({ bookId: john, chapter: 3 })).toBe(`/bible/read/${john}/3`);
    expect(readingHref({ bookId: john, chapter: 3, startVerse: 16, endVerse: 18 })).toBe(`/bible/read/${john}/3?verse=16`);
  });
});
