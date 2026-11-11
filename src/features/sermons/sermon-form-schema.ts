import { z } from 'zod';

import { toLocalDateString } from '@/lib/time';

import { isValidSermonDate } from './format';
import type { SermonRow } from './types';

export const seriesChoiceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('existing'), id: z.string().min(1) }),
  z.object({
    kind: z.literal('new'),
    title: z.string().trim().min(1, 'Name the new series').max(120, 'Keep the series name under 120 characters'),
  }),
]);

export const passageSchema = z
  .object({
    text: z.string(),
    startVerseId: z.number().int().positive(),
    endVerseId: z.number().int().positive(),
  })
  .refine((p) => p.endVerseId >= p.startVerseId, { message: 'The passage end must come after its start' });

/** Only the title matters, and it may be left blank (a dated default title is used). */
export const sermonFormSchema = z.object({
  title: z.string().trim().max(200, 'Keep the title under 200 characters'),
  speaker: z.string().trim().max(120, 'Keep the speaker under 120 characters'),
  church: z.string().trim().max(120, 'Keep the church under 120 characters'),
  series: seriesChoiceSchema,
  sermonDate: z.string().refine(isValidSermonDate, { message: 'Choose a valid date' }),
  mainPassage: passageSchema.nullable(),
});

export type SermonFormValues = z.input<typeof sermonFormSchema>;
export type SermonFormOutput = z.output<typeof sermonFormSchema>;
export type SeriesChoice = z.output<typeof seriesChoiceSchema>;

export function emptySermonForm(today: string = toLocalDateString()): SermonFormValues {
  return { title: '', speaker: '', church: '', series: { kind: 'none' }, sermonDate: today, mainPassage: null };
}

export function sermonToFormValues(sermon: SermonRow): SermonFormValues {
  const hasPassage = sermon.mainPassageStartVerseId !== null && sermon.mainPassageEndVerseId !== null;
  return {
    title: sermon.title,
    speaker: sermon.speaker ?? '',
    church: sermon.church ?? '',
    series: sermon.seriesId ? { kind: 'existing', id: sermon.seriesId } : { kind: 'none' },
    sermonDate: sermon.sermonDate ?? toLocalDateString(),
    mainPassage: hasPassage
      ? {
          text: sermon.mainPassage ?? '',
          startVerseId: sermon.mainPassageStartVerseId as number,
          endVerseId: sermon.mainPassageEndVerseId as number,
        }
      : null,
  };
}
