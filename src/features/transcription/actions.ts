/**
 * Transcription workflow (PRD §6.3F, flow C): resolve recording files → upload parts that are not
 * in the cloud yet → start the job → apply the result locally. Pure of React so it is unit tested.
 */
import { locateRecordingFile } from '@/features/recording/recording-files';
import { PLAYABLE_STATUSES } from '@/features/sermons/recordings-repository';
import type { RecordingRow } from '@/features/sermons/types';
import type { AppDatabase } from '@/db/types';
import { startTranscription } from '@/services/ai/api';
import { transcriptionResultSchema, type AiJob } from '@/services/ai/contracts';
import { AiServiceError } from '@/services/ai/errors';
import { MAX_TRANSCRIBE_BYTES, recordingObjectPath } from '@/services/upload/paths';
import { deleteCloudObjects, uploadRecordingFile } from '@/services/upload/upload-recording';
import type { UploadFileInput } from '@/services/upload/types';

import { setTimestampsApproximate } from './approximate-flags';
import { detectSegmentReferences } from './detect-references';
import { mergeTranscriptParts } from './merge';
import {
  listSegments,
  markTranscriptFailed,
  markTranscriptProcessing,
  replaceDetectedReferences,
  saveTranscriptResult,
  setRecordingCloudState,
} from './repository';

export interface PartFile {
  recording: RecordingRow;
  /** Null when the part is already in the cloud and needs no upload. */
  fileUri: string | null;
  sizeBytes: number;
}

export interface UploadProgress {
  partIndex: number;
  partCount: number;
  /** 0–1 across all parts that need uploading. */
  fraction: number;
}

function isInCloud(recording: RecordingRow): boolean {
  return recording.cloudStatus === 'uploaded' && recording.cloudPath !== null;
}

/** Parts that can be transcribed, in timeline order (the input is already ordered). */
export function eligibleRecordings(recordings: readonly RecordingRow[]): RecordingRow[] {
  return recordings.filter(
    (recording) => PLAYABLE_STATUSES.includes(recording.status) && (recording.localFileName !== null || isInCloud(recording)),
  );
}

export function totalDurationMs(recordings: readonly RecordingRow[]): number {
  return recordings.reduce((sum, recording) => sum + Math.max(0, recording.durationMs), 0);
}

type Locate = (fileName: string) => { uri: string; size: number | null } | null;

const defaultLocate: Locate = (fileName) => {
  const file = locateRecordingFile(fileName);
  if (!file) return null;
  let size: number | null = null;
  try {
    size = file.size;
  } catch {
    size = null;
  }
  return { uri: file.uri, size };
};

/** Find each part's file on disk and check the provider's size limit before any upload. */
export function resolvePartFiles(recordings: readonly RecordingRow[], locate: Locate = defaultLocate): PartFile[] {
  return recordings.map((recording) => {
    if (isInCloud(recording)) return { recording, fileUri: null, sizeBytes: recording.sizeBytes ?? 0 };
    const file = recording.localFileName ? locate(recording.localFileName) : null;
    if (!file) throw new AiServiceError('file_missing');
    const sizeBytes = file.size ?? recording.sizeBytes ?? 0;
    if (sizeBytes > MAX_TRANSCRIBE_BYTES) throw new AiServiceError('audio_too_large');
    return { recording, fileUri: file.uri, sizeBytes };
  });
}

export interface UploadAndStartParams {
  db: AppDatabase;
  sermonId: string;
  userId: string;
  transcriptId: string;
  parts: readonly PartFile[];
  language?: string | null;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
  upload?: (input: UploadFileInput) => Promise<void>;
  start?: typeof startTranscription;
}

/** Upload the parts that need it (updating `cloud_status`), then start the server job. */
export async function uploadAndStartTranscription(params: UploadAndStartParams): Promise<string> {
  const { db, sermonId, userId, transcriptId, parts, onProgress, signal } = params;
  const upload = params.upload ?? ((input: UploadFileInput) => uploadRecordingFile(input));
  const start = params.start ?? startTranscription;

  const pending = parts.filter((part) => part.fileUri !== null);
  const totalBytes = pending.reduce((sum, part) => sum + part.sizeBytes, 0) || 1;
  let doneBytes = 0;
  const paths = new Map<string, string>();

  for (const part of parts) {
    const { recording } = part;
    if (part.fileUri === null) {
      paths.set(recording.id, recording.cloudPath as string);
      continue;
    }
    const partIndex = pending.indexOf(part);
    const objectPath = recordingObjectPath(userId, sermonId, recording.id, recording.localFileName);
    setRecordingCloudState(db, recording.id, 'uploading', null);
    try {
      await upload({
        fileUri: part.fileUri,
        objectPath,
        contentType: recording.mimeType,
        sizeBytes: part.sizeBytes,
        signal,
        onProgress: (sent) =>
          onProgress?.({ partIndex, partCount: pending.length, fraction: Math.min(1, (doneBytes + sent) / totalBytes) }),
      });
    } catch (error) {
      setRecordingCloudState(db, recording.id, 'upload_failed', null);
      throw error;
    }
    setRecordingCloudState(db, recording.id, 'uploaded', objectPath);
    paths.set(recording.id, objectPath);
    doneBytes += part.sizeBytes;
    onProgress?.({ partIndex, partCount: pending.length, fraction: Math.min(1, doneBytes / totalBytes) });
  }

  const { jobId } = await start({
    sermonId,
    language: params.language ?? null,
    parts: parts.map(({ recording }) => ({
      recordingId: recording.id,
      path: paths.get(recording.id) as string,
      durationMs: recording.durationMs,
      mimeType: recording.mimeType,
    })),
  });
  markTranscriptProcessing(db, transcriptId, jobId);
  return jobId;
}

export type ApplyOutcome = { status: 'completed'; durationSec: number; segmentCount: number } | { status: 'failed'; errorCode: string };

/** Apply a finished job to the local transcript. */
export async function applyTranscriptionJob(params: {
  db: AppDatabase;
  transcriptId: string;
  job: AiJob;
  recordings: readonly RecordingRow[];
}): Promise<ApplyOutcome> {
  const { db, transcriptId, job, recordings } = params;
  if (job.status === 'failed') {
    const errorCode = job.errorCode ?? 'server';
    if (errorCode === 'audio_missing') {
      // The cloud copy is gone (retention or deleted): the next attempt re-uploads.
      recordings.forEach((recording) => setRecordingCloudState(db, recording.id, 'local', null));
    }
    markTranscriptFailed(db, transcriptId, errorCode);
    return { status: 'failed', errorCode };
  }

  const parsed = transcriptionResultSchema.safeParse(job.result);
  if (!parsed.success) {
    markTranscriptFailed(db, transcriptId, 'invalid_output');
    return { status: 'failed', errorCode: 'invalid_output' };
  }

  const merged = mergeTranscriptParts(
    parsed.data.parts,
    recordings.map((recording) => ({ id: recording.id, durationMs: recording.durationMs })),
  );
  const references = await detectSegmentReferences(merged.segments);
  saveTranscriptResult(db, transcriptId, { text: merged.text, language: merged.language, segments: merged.segments, references });
  await setTimestampsApproximate(transcriptId, merged.approximate);
  return { status: 'completed', durationSec: Math.round(totalDurationMs(recordings) / 1000), segmentCount: merged.segments.length };
}

/** Re-run reference detection after the user corrected the transcript. */
export async function refreshDetectedReferences(db: AppDatabase, transcriptId: string): Promise<void> {
  const references = await detectSegmentReferences(listSegments(db, transcriptId));
  replaceDetectedReferences(db, transcriptId, references);
}

/** Delete every cloud copy of the sermon's audio and mark the parts as local-only. */
export async function deleteSermonCloudAudio(
  db: AppDatabase,
  recordings: readonly RecordingRow[],
  remove: (paths: readonly string[]) => Promise<void> = deleteCloudObjects,
): Promise<number> {
  const inCloud = recordings.filter((recording) => recording.cloudPath !== null);
  await remove(inCloud.map((recording) => recording.cloudPath as string));
  inCloud.forEach((recording) => setRecordingCloudState(db, recording.id, 'cloud_deleted', null));
  return inCloud.length;
}
