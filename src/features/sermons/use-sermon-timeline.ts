import { useMemo } from 'react';

import type { BookmarkListItem } from '@/components/sermons/bookmark-list';
import type { RecordingPartItem } from '@/components/sermons/recording-parts';
import { buildTimeline, toGlobalMs, type Timeline } from '@/features/audio/timeline';
import { recordingUri } from '@/features/recording/recording-files';

import { PLAYABLE_STATUSES } from './recordings-repository';
import type { BookmarkRow, RecordingRow } from './types';

export interface SermonTimeline {
  timeline: Timeline;
  parts: RecordingPartItem[];
  bookmarks: BookmarkListItem[];
}

/** Playable timeline (parts with an audio file on this device), part rows and timeline-positioned bookmarks. */
export function useSermonTimeline(recordings: readonly RecordingRow[], bookmarkRows: readonly BookmarkRow[]): SermonTimeline {
  const timelineData = useMemo(() => {
    const located = recordings.map((row) => ({
      row,
      uri: PLAYABLE_STATUSES.includes(row.status) ? recordingUri(row.localFileName) : null,
    }));
    const timeline = buildTimeline(located.map(({ row, uri }) => ({ id: row.id, durationMs: row.durationMs, uri })));
    const parts: RecordingPartItem[] = located.map(({ row, uri }) => ({
      id: row.id,
      title: row.title,
      durationMs: row.durationMs,
      status: row.status,
      hasFile: uri !== null,
    }));
    return { timeline, parts };
  }, [recordings]);

  const bookmarks = useMemo(
    () =>
      bookmarkRows.map((row) => ({
        id: row.id,
        positionMs: toGlobalMs(timelineData.timeline, row.recordingId, row.positionMs),
        note: row.note,
        reference: row.reference,
      })),
    [bookmarkRows, timelineData.timeline],
  );

  return { ...timelineData, bookmarks };
}
