/**
 * Static reading plan definitions. Whole-book plans are generated from `BOOKS`;
 * the seven-day plans are curated passages.
 */
import { BOOKS, getBookByCode } from '@/features/bible/books';

import type { PlanDay, PlanReading, ReadingPlan } from './types';

function bookId(code: string): number {
  const book = getBookByCode(code);
  if (!book) throw new Error(`Unknown book code ${code}`);
  return book.id;
}

function chapterRun(code: string, from: number, to: number): PlanReading[] {
  const id = bookId(code);
  return Array.from({ length: to - from + 1 }, (_, index) => ({ bookId: id, chapter: from + index }));
}

/** Every chapter of the Bible in canonical order (1,189 chapters). */
export function allChapters(): PlanReading[] {
  return BOOKS.flatMap((book) => Array.from({ length: book.chapters }, (_, index) => ({ bookId: book.id, chapter: index + 1 })));
}

/** Spread readings over `dayCount` days as evenly as possible, keeping canonical order. */
export function spreadOverDays(readings: readonly PlanReading[], dayCount: number): PlanDay[] {
  return Array.from({ length: dayCount }, (_, index) => {
    const start = Math.floor((index * readings.length) / dayCount);
    const end = Math.floor(((index + 1) * readings.length) / dayCount);
    return { day: index + 1, readings: readings.slice(start, end) };
  });
}

function passage(code: string, chapter: number, startVerse?: number, endVerse?: number): PlanReading {
  return startVerse === undefined ? { bookId: bookId(code), chapter } : { bookId: bookId(code), chapter, startVerse, endVerse };
}

function curatedDays(entries: readonly [theme: string, reading: PlanReading][]): PlanDay[] {
  return entries.map(([theme, reading], index) => ({ day: index + 1, theme, readings: [reading] }));
}

const GRATITUDE_DAYS = curatedDays([
  ['Enter with thanksgiving', passage('PSA', 100)],
  ['Remembering his benefits', passage('PSA', 103, 1, 5)],
  ['Thanks in every circumstance', passage('1TH', 5, 16, 18)],
  ['Peace through thankful prayer', passage('PHP', 4, 4, 9)],
  ['Gratitude in community', passage('COL', 3, 12, 17)],
  ['The one who returned', passage('LUK', 17, 11, 19)],
  ['His love endures', passage('PSA', 136, 1, 9)],
]);

const HOPE_DAYS = curatedDays([
  ['New every morning', passage('LAM', 3, 19, 26)],
  ['Strength for the weary', passage('ISA', 40, 27, 31)],
  ['Hope in God', passage('PSA', 42)],
  ['A future and a hope', passage('JER', 29, 11, 14)],
  ['Glory yet to come', passage('ROM', 8, 18, 28)],
  ['A living hope', passage('1PE', 1, 3, 9)],
  ['All things new', passage('REV', 21, 1, 7)],
]);

export const READING_PLANS: readonly ReadingPlan[] = [
  {
    id: 'john-21',
    title: 'The Gospel of John',
    summary: '21 days · one chapter a day',
    description: 'Walk through John’s portrait of Jesus — his signs, his words and his love — one chapter at a time.',
    days: spreadOverDays(chapterRun('JHN', 1, 21), 21),
  },
  {
    id: 'psalms-30',
    title: 'Psalms in 30 days',
    summary: '30 days · five psalms a day',
    description: 'Pray and sing through all 150 psalms: lament, trust, praise and thanksgiving.',
    days: spreadOverDays(chapterRun('PSA', 1, 150), 30),
  },
  {
    id: 'bible-year',
    title: 'The Bible in a year',
    summary: '365 days · three or four chapters a day',
    description: 'Read the whole story of Scripture from Genesis to Revelation, at your own pace.',
    days: spreadOverDays(allChapters(), 365),
  },
  {
    id: 'gratitude-7',
    title: 'Seven days of gratitude',
    summary: '7 days · a short passage a day',
    description: 'Short passages that invite a thankful heart, with room to reflect on what you are grateful for.',
    days: GRATITUDE_DAYS,
  },
  {
    id: 'hope-7',
    title: 'Seven days of hope',
    summary: '7 days · a short passage a day',
    description: 'Passages for seasons that feel heavy — promises to hold on to, one day at a time.',
    days: HOPE_DAYS,
  },
];

const PLANS_BY_ID = new Map(READING_PLANS.map((plan) => [plan.id, plan]));

export function getPlan(planId: string): ReadingPlan | undefined {
  return PLANS_BY_ID.get(planId);
}

export function getPlanDay(plan: ReadingPlan, day: number): PlanDay | undefined {
  return plan.days[day - 1];
}
