import { z } from 'zod';

import { getBook } from '../books';
import type { VerseRange } from '../types';
import { fromVerseId, idsToRange } from '../verse-id';

/** Highest verse number in any chapter (Psalm 119 has 176). */
export const MAX_VERSE_NUMBER = 200;

type RawParam = string | string[] | undefined;
export type RawParams = Record<string, RawParam>;

/** expo-router may deliver repeated params as arrays; take the first value. */
const single = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const emptyToUndefined = (value: unknown) => {
  const first = single(value);
  return first === '' || first === null ? undefined : first;
};

const positiveInt = z.preprocess(single, z.coerce.number().int().positive());
const optionalPositiveInt = z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional());

export function isValidVerseId(id: number): boolean {
  if (!Number.isInteger(id) || id <= 0) return false;
  const { bookId, chapter, verse } = fromVerseId(id);
  const book = getBook(bookId);
  return !!book && chapter >= 1 && chapter <= book.chapters && verse >= 1 && verse <= MAX_VERSE_NUMBER;
}

const readerSchema = z
  .object({ bookId: positiveInt, chapter: positiveInt, verse: optionalPositiveInt })
  .refine(({ bookId }) => !!getBook(bookId), { message: 'Unknown book', path: ['bookId'] })
  .refine(({ bookId, chapter }) => chapter <= (getBook(bookId)?.chapters ?? 0), {
    message: 'Unknown chapter',
    path: ['chapter'],
  })
  .refine(({ verse }) => verse === undefined || verse <= MAX_VERSE_NUMBER, { message: 'Unknown verse', path: ['verse'] });

export interface ReaderParams {
  bookId: number;
  chapter: number;
  verse?: number;
}

export function parseReaderParams(params: RawParams): ReaderParams | null {
  const result = readerSchema.safeParse(params);
  return result.success ? result.data : null;
}

const rangeSchema = z
  .object({ start: positiveInt, end: optionalPositiveInt })
  .transform(({ start, end = start }) => (start <= end ? { start, end } : { start: end, end: start }))
  .refine(({ start, end }) => isValidVerseId(start) && isValidVerseId(end), { message: 'Unknown verse' });

export interface VerseRangeParams {
  startVerseId: number;
  endVerseId: number;
  range: VerseRange;
}

/** Parse `?start=&end=` verse-id params (end defaults to start; reversed ranges are normalised). */
export function parseVerseRangeParams(params: RawParams): VerseRangeParams | null {
  const result = rangeSchema.safeParse({ start: params.start, end: params.end });
  if (!result.success) return null;
  const { start, end } = result.data;
  return { startVerseId: start, endVerseId: end, range: idsToRange(start, end) };
}
