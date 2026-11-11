/** Deletes that also remove audio files from the device (rows are soft-deleted for sync). */
import type { AppDatabase } from '@/db/types';
import { deleteRecording } from '@/features/sermons/recordings-repository';
import { deleteSermon } from '@/features/sermons/sermons-repository';

import { deleteRecordingFiles } from './recording-files';

export function deleteSermonAndRecordings(db: AppDatabase, sermonId: string): void {
  const { recordingFileNames } = deleteSermon(db, sermonId);
  deleteRecordingFiles(recordingFileNames);
}

export function deleteRecordingAndFile(db: AppDatabase, recordingId: string): void {
  const { localFileName } = deleteRecording(db, recordingId);
  if (localFileName) deleteRecordingFiles([localFileName]);
}
