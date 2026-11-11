/** Turns validated sermon form values into repository writes (series creation + sermon in one transaction). */
import type { AppDatabase } from '@/db/types';

import type { SeriesChoice, SermonFormOutput } from './sermon-form-schema';
import { findOrCreateSeries } from './series-repository';
import { createSermon, updateSermon } from './sermons-repository';
import type { SermonInput, SermonRow } from './types';

function resolveSeriesId(db: AppDatabase, series: SeriesChoice): string | null {
  switch (series.kind) {
    case 'none':
      return null;
    case 'existing':
      return series.id;
    case 'new':
      return findOrCreateSeries(db, series.title).id;
  }
}

function toSermonInput(db: AppDatabase, values: SermonFormOutput): SermonInput {
  return {
    title: values.title,
    speaker: values.speaker,
    church: values.church,
    seriesId: resolveSeriesId(db, values.series),
    sermonDate: values.sermonDate,
    mainPassage: values.mainPassage,
  };
}

export function createSermonFromForm(db: AppDatabase, values: SermonFormOutput): SermonRow {
  return db.transaction((tx) => createSermon(tx, toSermonInput(tx, values)));
}

export function updateSermonFromForm(db: AppDatabase, id: string, values: SermonFormOutput): SermonRow | null {
  return db.transaction((tx) => updateSermon(tx, id, toSermonInput(tx, values)));
}
