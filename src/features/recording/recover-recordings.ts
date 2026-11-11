/**
 * Crash recovery. Parts left in `recording`/`paused` (the app was terminated, ran out of battery…)
 * become `interrupted` when their file is a finalised, playable m4a — or `failed` otherwise.
 * Parts being recorded right now in this process are skipped, so any screen may call this safely.
 */
import type { AppDatabase } from '@/db/types';
import { listUnfinishedRecordings, updateRecording } from '@/features/sermons/recordings-repository';
import { logger } from '@/lib/logger';
import { nowIso } from '@/lib/time';
import { track as trackEvent, type AnalyticsEvent } from '@/services/monitoring/analytics';

import { isRecordingActive } from './active-recordings';
import { inspectStoredRecording, type InspectedFile } from './recording-files';

export type RecoveryInspector = (fileName: string) => InspectedFile | null;

export interface RecoveryDeps {
  inspect: RecoveryInspector;
  track: (event: AnalyticsEvent) => void;
}

export interface RecoveryResult {
  recovered: number;
  failed: number;
  /** Sermons that had an interrupted part (recovered or not). */
  sermonIds: string[];
}

const defaultDeps: RecoveryDeps = {
  inspect: (fileName) => inspectStoredRecording(fileName),
  track: trackEvent,
};

function safeInspect(inspect: RecoveryInspector, fileName: string | null): InspectedFile | null {
  if (!fileName) return null;
  try {
    return inspect(fileName);
  } catch (error) {
    logger.error('Could not inspect interrupted recording', error);
    return null;
  }
}

export function recoverInterruptedRecordings(db: AppDatabase, deps: RecoveryDeps = defaultDeps): RecoveryResult {
  const parts = listUnfinishedRecordings(db).filter((part) => !isRecordingActive(part.id));
  let recovered = 0;
  let failed = 0;
  const sermonIds = new Set<string>();

  parts.forEach((part) => {
    const file = safeInspect(deps.inspect, part.localFileName);
    const playable = file?.inspection.playable === true;
    try {
      updateRecording(db, part.id, {
        status: playable ? 'interrupted' : 'failed',
        durationMs: playable ? (file?.inspection.durationMs ?? part.durationMs) : part.durationMs,
        sizeBytes: file?.sizeBytes ?? null,
        endedAt: part.endedAt ?? nowIso(),
      });
    } catch (error) {
      logger.error('Could not update interrupted recording', error);
      return;
    }
    sermonIds.add(part.sermonId);
    if (playable) {
      recovered += 1;
      deps.track({ name: 'recording_interrupted' });
    } else {
      failed += 1;
    }
  });

  return { recovered, failed, sermonIds: [...sermonIds] };
}
