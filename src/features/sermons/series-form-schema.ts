import { z } from 'zod';

import type { SeriesRow } from './types';

export const seriesFormSchema = z.object({
  title: z.string().trim().min(1, 'Give the series a name').max(120, 'Keep the name under 120 characters'),
  description: z.string().trim().max(2000, 'Keep the description under 2000 characters'),
  speaker: z.string().trim().max(120, 'Keep the speaker under 120 characters'),
  church: z.string().trim().max(120, 'Keep the church under 120 characters'),
});

export type SeriesFormValues = z.input<typeof seriesFormSchema>;
export type SeriesFormOutput = z.output<typeof seriesFormSchema>;

export function emptySeriesForm(): SeriesFormValues {
  return { title: '', description: '', speaker: '', church: '' };
}

export function seriesToFormValues(series: SeriesRow): SeriesFormValues {
  return {
    title: series.title,
    description: series.description ?? '',
    speaker: series.speaker ?? '',
    church: series.church ?? '',
  };
}
