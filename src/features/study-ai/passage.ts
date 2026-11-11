/**
 * The passage a study is about: validated route params → verses from the local (licensed) Bible.
 * The verse text sent to the AI comes from the device, never from the model.
 */
import { z } from 'zod';

import { formatReference } from '@/features/bible/reference';
import { DEFAULT_TRANSLATION, getVerses } from '@/features/bible/repository';
import type { Verse, VerseRange } from '@/features/bible/types';
import { fromVerseId, idsToRange } from '@/features/bible/verse-id';
import type { PassageContext } from '@/services/ai/contracts';

/** Long passages are trimmed so requests stay small (server limit 20k chars). */
export const MAX_STUDY_VERSES = 120;
const MAX_PASSAGE_CHARS = 18_000;

const verseIdParam = z.coerce.number().int().min(1_001_001).max(66_999_999);

export function parsePassageParams(params: { start?: string | string[]; end?: string | string[] }): { start: number; end: number } | null {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const start = verseIdParam.safeParse(first(params.start));
  if (!start.success) return null;
  const rawEnd = first(params.end);
  const end = rawEnd === undefined || rawEnd === '' ? { success: true as const, data: start.data } : verseIdParam.safeParse(rawEnd);
  if (!end.success || end.data < start.data) return null;
  const startRef = fromVerseId(start.data);
  const endRef = fromVerseId(end.data);
  if (startRef.chapter < 1 || startRef.verse < 1 || endRef.chapter < 1 || endRef.verse < 1 || startRef.bookId !== endRef.bookId) return null;
  return { start: start.data, end: end.data };
}

export interface LoadedPassage {
  range: VerseRange;
  reference: string;
  translation: string;
  verses: Verse[];
  /** True when the passage was longer than the study limit. */
  truncated: boolean;
}

export async function loadPassage(start: number, end: number): Promise<LoadedPassage> {
  const range = idsToRange(start, end);
  const all = await getVerses(range);
  const verses = all.slice(0, MAX_STUDY_VERSES);
  return {
    range,
    reference: formatReference(range),
    translation: DEFAULT_TRANSLATION.abbreviation,
    verses,
    truncated: all.length > verses.length,
  };
}

/** "16 For God so loved…" lines; chapter:verse when the passage spans chapters. */
export function passageText(verses: readonly Verse[]): string {
  const multiChapter = verses.length > 0 && verses.some((verse) => verse.chapter !== verses[0].chapter);
  const lines = verses.map((verse) => `${multiChapter ? `${verse.chapter}:` : ''}${verse.verse} ${verse.text.trim()}`);
  return lines.join('\n').slice(0, MAX_PASSAGE_CHARS);
}

export function toPassageContext(passage: LoadedPassage): PassageContext {
  return { reference: passage.reference, translation: passage.translation, passageText: passageText(passage.verses) };
}
