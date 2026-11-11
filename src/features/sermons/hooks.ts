/** React bindings for the sermon repositories (reactive local reads). */
import { db } from '@/db/client';

import { listBookmarks } from './bookmarks-repository';
import { getSermonNote } from './notes-repository';
import { listRecordings } from './recordings-repository';
import { getSermonAiStatus, listSermonActionItems } from './sermon-extras-repository';
import { getSeries, listSeries, seriesBookIds } from './series-repository';
import { getSermon, listSermons } from './sermons-repository';
import type {
  ActionItemRow,
  BookmarkRow,
  RecordingRow,
  SeriesListItem,
  SeriesRow,
  SermonAiStatus,
  SermonListItem,
  SermonListOptions,
  SermonNoteRow,
  SermonRow,
} from './types';
import { useDbQuery, type DbQueryResult } from './use-db-query';

const LIBRARY_TABLES = ['sermons', 'sermon_series', 'sermon_recordings', 'sermon_bookmarks', 'transcripts', 'sermon_recaps'];
const NO_ITEMS: never[] = [];

export function useSermonList(options: SermonListOptions): DbQueryResult<SermonListItem[]> {
  return useDbQuery(() => listSermons(db, options), LIBRARY_TABLES, JSON.stringify(options), NO_ITEMS);
}

export function useSeriesList(query?: string): DbQueryResult<SeriesListItem[]> {
  return useDbQuery(() => listSeries(db, { query }), ['sermon_series', 'sermons'], query ?? '', NO_ITEMS);
}

export function useSermon(id: string): DbQueryResult<SermonRow | null> {
  return useDbQuery(() => getSermon(db, id), ['sermons'], id, null);
}

export function useSeries(id: string): DbQueryResult<SeriesRow | null> {
  return useDbQuery(() => getSeries(db, id), ['sermon_series'], id, null);
}

export function useSeriesBookIds(id: string): DbQueryResult<number[]> {
  return useDbQuery(() => seriesBookIds(db, id), ['sermons'], id, NO_ITEMS);
}

export function useRecordings(sermonId: string): DbQueryResult<RecordingRow[]> {
  return useDbQuery(() => listRecordings(db, sermonId), ['sermon_recordings'], sermonId, NO_ITEMS);
}

export function useBookmarks(sermonId: string): DbQueryResult<BookmarkRow[]> {
  return useDbQuery(() => listBookmarks(db, sermonId), ['sermon_bookmarks', 'sermon_recordings'], sermonId, NO_ITEMS);
}

export function useSermonNote(sermonId: string): DbQueryResult<SermonNoteRow | null> {
  return useDbQuery(() => getSermonNote(db, sermonId), ['sermon_notes'], sermonId, null);
}

const NO_AI_STATUS: SermonAiStatus = { transcriptStatus: null, recapStatus: null };

export function useSermonAiStatus(sermonId: string): DbQueryResult<SermonAiStatus> {
  return useDbQuery(() => getSermonAiStatus(db, sermonId), ['transcripts', 'sermon_recaps'], sermonId, NO_AI_STATUS);
}

export function useSermonActionItems(sermonId: string): DbQueryResult<ActionItemRow[]> {
  return useDbQuery(() => listSermonActionItems(db, sermonId), ['action_items', 'sermon_recaps'], sermonId, NO_ITEMS);
}
