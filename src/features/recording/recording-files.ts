/**
 * Recording files on disk. Finished parts live in `<document>/recordings/<partId>.m4a`; the database
 * stores only that file name (the iOS container path changes between installs).
 * While recording, expo-audio writes to `<document>/ExpoAudio` (iOS) or `<document>/Audio` (Android);
 * a part is moved into `recordings/` once it is finalised. Lookups check both places.
 */
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

import { inspectMp4, type Mp4Inspection } from './mp4-inspect';
import { RECORDING_EXTENSION } from './recording-options';
import type { PartFileInfo, RecordingFilesPort } from './recording-session';

export const RECORDINGS_FOLDER = 'recordings';
const NATIVE_RECORDER_FOLDER = Platform.OS === 'android' ? 'Audio' : 'ExpoAudio';
const SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/;

export function recordingFileName(partId: string): string {
  return `${partId}${RECORDING_EXTENSION}`;
}

function assertSafeName(fileName: string): void {
  if (!SAFE_FILE_NAME.test(fileName) || fileName.includes('..')) throw new Error('Invalid recording file name');
}

function recordingsDirectory(): Directory {
  const directory = new Directory(Paths.document, RECORDINGS_FOLDER);
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/** The file for a stored name, wherever it currently is; null when it no longer exists. */
export function locateRecordingFile(fileName: string): File | null {
  assertSafeName(fileName);
  const finished = new File(Paths.document, RECORDINGS_FOLDER, fileName);
  if (finished.exists) return finished;
  const inProgress = new File(Paths.document, NATIVE_RECORDER_FOLDER, fileName);
  return inProgress.exists ? inProgress : null;
}

/** Playable `file://` URI for a stored file name, or null when the file is missing. */
export function recordingUri(fileName: string | null): string | null {
  if (!fileName) return null;
  try {
    return locateRecordingFile(fileName)?.uri ?? null;
  } catch (error) {
    logger.warn('Recording file lookup failed', { message: error instanceof Error ? error.message : 'unknown' });
    return null;
  }
}

/** Move a part into `recordings/` (no-op when it is already there). Returns its final location. */
export function adoptRecordingFile(fileName: string, sourceUri?: string | null): File | null {
  assertSafeName(fileName);
  const target = new File(recordingsDirectory(), fileName);
  if (target.exists) return target;
  const source = sourceUri ? new File(sourceUri) : new File(Paths.document, NATIVE_RECORDER_FOLDER, fileName);
  if (!source.exists) return null;
  source.moveSync(target);
  return target;
}

export function deleteRecordingFile(fileName: string): void {
  const file = locateRecordingFile(fileName);
  if (file) file.delete();
}

/** Delete files for removed parts; failures are logged, never thrown (the rows are already gone). */
export function deleteRecordingFiles(fileNames: readonly string[]): void {
  fileNames.forEach((fileName) => {
    try {
      deleteRecordingFile(fileName);
    } catch (error) {
      logger.error('Could not delete recording file', error);
    }
  });
}

function fileSize(file: File): number | null {
  try {
    return file.size;
  } catch {
    return null;
  }
}

/** Reads only box headers and the `mvhd` box, so it is cheap even for long parts. */
export function inspectRecordingFile(file: File): Mp4Inspection {
  const handle = file.open(FileMode.ReadOnly);
  try {
    return inspectMp4({
      size: handle.size ?? 0,
      read: (offset, length) => {
        handle.offset = offset;
        return handle.readBytesSync(length);
      },
    });
  } finally {
    handle.close();
  }
}

export interface InspectedFile {
  sizeBytes: number | null;
  inspection: Mp4Inspection;
}

/** Locate, move into place and inspect a stored part; null when there is no file. */
export function inspectStoredRecording(fileName: string, sourceUri?: string | null): InspectedFile | null {
  const file = adoptRecordingFile(fileName, sourceUri) ?? locateRecordingFile(fileName);
  if (!file) return null;
  return { sizeBytes: fileSize(file), inspection: inspectRecordingFile(file) };
}

/** File operations used by the recording session. */
export const recordingFilesPort: RecordingFilesPort = {
  fileNameFor: recordingFileName,
  finalize: async (partId, recorderUrl, { inspect }): Promise<PartFileInfo> => {
    const inspected = inspectStoredRecording(recordingFileName(partId), recorderUrl);
    if (!inspected) return { sizeBytes: null, playable: false, durationMs: null };
    const { sizeBytes, inspection } = inspected;
    const durationMs = inspection.durationMs && inspection.durationMs > 0 ? inspection.durationMs : null;
    // After a clean stop we trust the recorder; only an unclean stop uses the inspection's verdict.
    return { sizeBytes, playable: inspect ? inspection.playable : null, durationMs };
  },
};
