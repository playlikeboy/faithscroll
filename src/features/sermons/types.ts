import type {
  actionItems,
  AI_STATUSES,
  RECORDING_STATUSES,
  sermonBookmarks,
  sermonNotes,
  sermonRecordings,
  sermons,
  sermonSeries,
} from '@/db/schema';

export type SermonRow = typeof sermons.$inferSelect;
export type SeriesRow = typeof sermonSeries.$inferSelect;
export type RecordingRow = typeof sermonRecordings.$inferSelect;
export type BookmarkRow = typeof sermonBookmarks.$inferSelect;
export type SermonNoteRow = typeof sermonNotes.$inferSelect;
export type ActionItemRow = typeof actionItems.$inferSelect;

export type RecordingStatus = (typeof RECORDING_STATUSES)[number];
export type AiStatus = (typeof AI_STATUSES)[number];

/** A Bible passage stored alongside a sermon or bookmark: display text plus inclusive verse ids. */
export interface PassageValue {
  text: string;
  startVerseId: number;
  endVerseId: number;
}

/** Fields accepted when creating or editing a sermon. `undefined` = leave unchanged, `null` = clear. */
export interface SermonInput {
  title?: string | null;
  speaker?: string | null;
  church?: string | null;
  seriesId?: string | null;
  /** Calendar date YYYY-MM-DD. Defaults to today on create. */
  sermonDate?: string | null;
  mainPassage?: PassageValue | null;
}

/** One row of the sermon library. */
export interface SermonListItem {
  id: string;
  title: string;
  speaker: string | null;
  church: string | null;
  seriesId: string | null;
  seriesTitle: string | null;
  sermonDate: string | null;
  mainPassage: string | null;
  mainPassageStartVerseId: number | null;
  mainPassageEndVerseId: number | null;
  createdAt: string;
  /** Sum of playable recording parts (saved or recovered). */
  totalDurationMs: number;
  recordingCount: number;
  bookmarkCount: number;
  transcriptStatus: AiStatus | null;
  recapStatus: AiStatus | null;
}

export interface SermonListOptions {
  /** Free-text filter over title, speaker, church, series title and main passage. */
  query?: string;
  seriesId?: string;
  /** 'newest' (default) for the library, 'oldest' for a series timeline. */
  order?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export interface SeriesInput {
  title?: string;
  description?: string | null;
  speaker?: string | null;
  church?: string | null;
}

export interface SeriesListItem extends SeriesRow {
  sermonCount: number;
  firstSermonDate: string | null;
  lastSermonDate: string | null;
}

export interface SermonAiStatus {
  transcriptStatus: AiStatus | null;
  recapStatus: AiStatus | null;
}
