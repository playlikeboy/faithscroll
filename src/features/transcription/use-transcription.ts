/**
 * Everything the transcript screen needs: local transcript state, upload progress, job polling,
 * applying results, and user actions. Never uploads without an explicit `start()` call.
 */
import { useCallback, useEffect, useMemo } from 'react';

import { db } from '@/db/client';
import { useSession } from '@/features/auth/use-session';
import { useRecordings } from '@/features/sermons/hooks';
import { useDbQuery } from '@/features/sermons/use-db-query';
import { logger } from '@/lib/logger';
import { isTerminalStatus } from '@/services/ai/contracts';
import { isRetryable, toAiServiceError, type AiClientErrorCode } from '@/services/ai/errors';
import { useAiJob } from '@/services/ai/use-ai-job';
import { track } from '@/services/monitoring/analytics';
import { isSupabaseConfigured } from '@/services/supabase/client';

import {
  applyTranscriptionJob,
  deleteSermonCloudAudio,
  eligibleRecordings,
  refreshDetectedReferences,
  resolvePartFiles,
  totalDurationMs,
  uploadAndStartTranscription,
} from './actions';
import { useTimestampsApproximate } from './approximate-flags';
import { transcriptionPhase, type TranscriptionPhase } from './phase';
import {
  beginTranscript,
  deleteTranscript,
  getLatestTranscript,
  listSegments,
  listTranscriptReferences,
  markTranscriptFailed,
  updateSegmentText,
  type ScriptureReferenceRow,
  type SegmentRow,
  type TranscriptRow,
} from './repository';
import {
  cancelTranscriptionUpload,
  registerUploadController,
  releaseUploadController,
  useTranscriptionUploads,
} from './upload-store';

export type TranscriptionGate = 'ready' | 'not_configured' | 'signed_out' | 'no_recording';

interface TranscriptView {
  transcript: TranscriptRow | null;
  segments: SegmentRow[];
  references: ScriptureReferenceRow[];
}

const EMPTY_VIEW: TranscriptView = { transcript: null, segments: [], references: [] };
const TABLES = ['transcripts', 'transcript_segments', 'scripture_references'];

/** Jobs already applied in this JS runtime (guards against double application across mounts). */
const appliedJobs = new Set<string>();

function readView(sermonId: string): TranscriptView {
  const transcript = getLatestTranscript(db, sermonId);
  if (!transcript) return EMPTY_VIEW;
  const done = transcript.status === 'completed';
  return {
    transcript,
    segments: done ? listSegments(db, transcript.id) : [],
    references: done ? listTranscriptReferences(db, transcript.id) : [],
  };
}

export interface TranscriptionController {
  gate: TranscriptionGate;
  phase: TranscriptionPhase;
  transcript: TranscriptRow | null;
  segments: SegmentRow[];
  references: ScriptureReferenceRow[];
  /** Parts that would be transcribed, in timeline order. */
  partCount: number;
  durationMs: number;
  /** Parts done / total while the server is transcribing. */
  jobProgress: { done: number; total: number } | null;
  approximateTimestamps: boolean;
  cloudCopyCount: number;
  start: () => Promise<AiClientErrorCode | null>;
  cancelUpload: () => void;
  saveSegment: (segmentId: string, text: string) => Promise<void>;
  removeTranscript: () => void;
  deleteCloudAudio: () => Promise<number>;
}

export function useTranscription(sermonId: string): TranscriptionController {
  const { data: allRecordings } = useRecordings(sermonId);
  const recordings = useMemo(() => eligibleRecordings(allRecordings), [allRecordings]);
  const { data: view } = useDbQuery(() => readView(sermonId), TABLES, sermonId, EMPTY_VIEW);
  const { userId } = useSession();
  const upload = useTranscriptionUploads((state) => state.bySermon[sermonId]);
  const { transcript } = view;
  const phase = transcriptionPhase(transcript, upload);

  const jobId = phase.kind === 'processing' ? (transcript?.remoteJobId ?? null) : null;
  const job = useAiJob(jobId);
  const approximateTimestamps = useTimestampsApproximate(phase.kind === 'completed' ? (transcript?.id ?? null) : null, transcript?.version ?? 0);

  // Apply a finished job exactly once.
  useEffect(() => {
    const data = job.data;
    if (!data || !transcript || data.id !== transcript.remoteJobId || !isTerminalStatus(data.status) || appliedJobs.has(data.id)) return;
    appliedJobs.add(data.id);
    applyTranscriptionJob({ db, transcriptId: transcript.id, job: data, recordings })
      .then((outcome) =>
        track(
          outcome.status === 'completed'
            ? { name: 'transcription_completed', durationSec: outcome.durationSec }
            : { name: 'transcription_failed', errorCode: outcome.errorCode },
        ),
      )
      .catch((error: unknown) => {
        logger.error('Applying a transcription result failed', error);
        markTranscriptFailed(db, transcript.id, 'server');
      });
  }, [job.data, transcript, recordings]);

  // A job the server no longer knows about (or a permanent error) ends the wait.
  useEffect(() => {
    if (!job.error || !transcript || phase.kind !== 'processing' || isRetryable(job.error.code)) return;
    markTranscriptFailed(db, transcript.id, job.error.code);
  }, [job.error, transcript, phase.kind]);

  const start = useCallback(async (): Promise<AiClientErrorCode | null> => {
    if (!isSupabaseConfigured()) return 'not_configured';
    if (!userId) return 'signed_out';
    const store = useTranscriptionUploads.getState();
    const controller = registerUploadController(sermonId);
    store.begin(sermonId);
    const row = beginTranscript(db, sermonId, recordings.length === 1 ? recordings[0].id : null);
    track({ name: 'transcription_requested' });
    try {
      const parts = resolvePartFiles(recordings);
      await uploadAndStartTranscription({
        db,
        sermonId,
        userId,
        transcriptId: row.id,
        parts,
        signal: controller.signal,
        onProgress: (progress) => (progress.fraction >= 1 ? store.starting(sermonId) : store.progress(sermonId, progress)),
      });
      return null;
    } catch (error) {
      const code = toAiServiceError(error).code;
      markTranscriptFailed(db, row.id, code);
      if (code !== 'cancelled') track({ name: 'transcription_failed', errorCode: code });
      return code;
    } finally {
      releaseUploadController(sermonId, controller);
      useTranscriptionUploads.getState().end(sermonId);
    }
  }, [recordings, sermonId, userId]);

  const saveSegment = useCallback(
    async (segmentId: string, text: string) => {
      if (!transcript) return;
      updateSegmentText(db, transcript.id, segmentId, text);
      await refreshDetectedReferences(db, transcript.id);
    },
    [transcript],
  );

  const removeTranscript = useCallback(() => {
    if (transcript) deleteTranscript(db, transcript.id);
  }, [transcript]);

  const deleteCloudAudio = useCallback(() => deleteSermonCloudAudio(db, allRecordings), [allRecordings]);

  const gate: TranscriptionGate = !isSupabaseConfigured()
    ? 'not_configured'
    : !userId
      ? 'signed_out'
      : recordings.length === 0
        ? 'no_recording'
        : 'ready';

  return {
    gate,
    phase,
    transcript,
    segments: view.segments,
    references: view.references,
    partCount: recordings.length,
    durationMs: totalDurationMs(recordings),
    jobProgress: job.data?.progress ?? null,
    approximateTimestamps,
    cloudCopyCount: allRecordings.filter((recording) => recording.cloudPath !== null).length,
    start,
    cancelUpload: () => cancelTranscriptionUpload(sermonId),
    saveSegment,
    removeTranscript,
    deleteCloudAudio,
  };
}
