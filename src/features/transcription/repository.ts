/**
 * Local persistence for transcripts, their timestamped segments and the Scripture references
 * detected in them. Every syncable write enqueues an outbox change in the same transaction.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { CLOUD_STATUSES, scriptureReferences, sermonRecordings, transcriptSegments, transcripts } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import type { MergedSegment } from './merge';

export type TranscriptRow = typeof transcripts.$inferSelect;
export type SegmentRow = typeof transcriptSegments.$inferSelect;
export type ScriptureReferenceRow = typeof scriptureReferences.$inferSelect;
export type CloudStatus = (typeof CLOUD_STATUSES)[number];

export interface DetectedReference {
  startVerseId: number;
  endVerseId: number;
  referenceText: string;
  positionMs: number | null;
}

export function getLatestTranscript(db: AppDatabase, sermonId: string): TranscriptRow | null {
  return (
    db
      .select()
      .from(transcripts)
      .where(and(eq(transcripts.sermonId, sermonId), isNull(transcripts.deletedAt)))
      .orderBy(desc(transcripts.createdAt))
      .get() ?? null
  );
}

export function getTranscript(db: AppDatabase, id: string): TranscriptRow | null {
  return db.select().from(transcripts).where(and(eq(transcripts.id, id), isNull(transcripts.deletedAt))).get() ?? null;
}

export function listSegments(db: AppDatabase, transcriptId: string): SegmentRow[] {
  return db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.transcriptId, transcriptId))
    .orderBy(asc(transcriptSegments.sortOrder))
    .all();
}

export function listTranscriptReferences(db: AppDatabase, transcriptId: string): ScriptureReferenceRow[] {
  return db
    .select()
    .from(scriptureReferences)
    .where(
      and(
        eq(scriptureReferences.sourceType, 'transcript'),
        eq(scriptureReferences.sourceId, transcriptId),
        isNull(scriptureReferences.deletedAt),
      ),
    )
    .orderBy(asc(scriptureReferences.positionMs), asc(scriptureReferences.startVerseId))
    .all();
}

/**
 * Start (or restart) a transcription: reuses the latest unfinished transcript of the sermon,
 * otherwise creates one. The row is marked `uploading` so an interrupted upload is visible later.
 */
export function beginTranscript(db: AppDatabase, sermonId: string, recordingId: string | null): TranscriptRow {
  const latest = getLatestTranscript(db, sermonId);
  return db.transaction((tx) => {
    if (latest && latest.status !== 'completed') {
      tx.update(transcripts)
        .set({ status: 'uploading', errorCode: null, remoteJobId: null, recordingId, ...touch(transcripts.version) })
        .where(eq(transcripts.id, latest.id))
        .run();
      enqueueChange(tx, 'transcript', latest.id);
      return { ...latest, status: 'uploading' as const, errorCode: null, remoteJobId: null, recordingId };
    }
    const id = newId();
    tx.insert(transcripts).values({ id, sermonId, recordingId, status: 'uploading' }).run();
    enqueueChange(tx, 'transcript', id);
    return tx.select().from(transcripts).where(eq(transcripts.id, id)).get() as TranscriptRow;
  });
}

function patchTranscript(db: AppDatabase, id: string, patch: Partial<typeof transcripts.$inferInsert>): void {
  db.transaction((tx) => {
    tx.update(transcripts).set({ ...patch, ...touch(transcripts.version) }).where(eq(transcripts.id, id)).run();
    enqueueChange(tx, 'transcript', id);
  });
}

export function markTranscriptProcessing(db: AppDatabase, id: string, remoteJobId: string): void {
  patchTranscript(db, id, { status: 'processing', remoteJobId, errorCode: null });
}

export function markTranscriptFailed(db: AppDatabase, id: string, errorCode: string): void {
  patchTranscript(db, id, { status: 'failed', errorCode });
}

function insertReferences(tx: AppDatabase, transcriptId: string, references: readonly DetectedReference[]): void {
  references.forEach((reference) => {
    const id = newId();
    tx.insert(scriptureReferences)
      .values({ id, sourceType: 'transcript', sourceId: transcriptId, origin: 'detected', ...reference })
      .run();
    enqueueChange(tx, 'scripture_reference', id);
  });
}

function tombstoneDetectedReferences(tx: AppDatabase, transcriptId: string): void {
  const existing = tx
    .select({ id: scriptureReferences.id })
    .from(scriptureReferences)
    .where(
      and(
        eq(scriptureReferences.sourceType, 'transcript'),
        eq(scriptureReferences.sourceId, transcriptId),
        eq(scriptureReferences.origin, 'detected'),
        isNull(scriptureReferences.deletedAt),
      ),
    )
    .all();
  existing.forEach(({ id }) => {
    tx.update(scriptureReferences).set(tombstone(scriptureReferences.version)).where(eq(scriptureReferences.id, id)).run();
    enqueueChange(tx, 'scripture_reference', id, 'delete');
  });
}

export interface TranscriptResultInput {
  text: string;
  language: string | null;
  segments: readonly MergedSegment[];
  references: readonly DetectedReference[];
}

/** Store a finished transcript: text, segments and detected references, replacing earlier ones. */
export function saveTranscriptResult(db: AppDatabase, transcriptId: string, result: TranscriptResultInput): void {
  db.transaction((tx) => {
    tx.delete(transcriptSegments).where(eq(transcriptSegments.transcriptId, transcriptId)).run();
    result.segments.forEach((segment, index) => {
      tx.insert(transcriptSegments)
        .values({ id: newId(), transcriptId, startMs: segment.startMs, endMs: segment.endMs, text: segment.text, sortOrder: index })
        .run();
    });
    tx.update(transcripts)
      .set({
        status: 'completed',
        text: result.text,
        language: result.language,
        errorCode: null,
        editedAt: null,
        ...touch(transcripts.version),
      })
      .where(eq(transcripts.id, transcriptId))
      .run();
    enqueueChange(tx, 'transcript', transcriptId);
    tombstoneDetectedReferences(tx, transcriptId);
    insertReferences(tx, transcriptId, result.references);
  });
}

/** Correct one segment; the transcript's full text is rebuilt from its segments. */
export function updateSegmentText(db: AppDatabase, transcriptId: string, segmentId: string, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Segment text cannot be empty');
  db.transaction((tx) => {
    tx.update(transcriptSegments)
      .set({ text: trimmed })
      .where(and(eq(transcriptSegments.id, segmentId), eq(transcriptSegments.transcriptId, transcriptId)))
      .run();
    const fullText = listSegments(tx, transcriptId)
      .map((segment) => segment.text)
      .join(' ');
    tx.update(transcripts)
      .set({ text: fullText, editedAt: nowIso(), ...touch(transcripts.version) })
      .where(eq(transcripts.id, transcriptId))
      .run();
    enqueueChange(tx, 'transcript', transcriptId);
  });
}

/** Replace automatically detected references (user-added ones are kept). */
export function replaceDetectedReferences(db: AppDatabase, transcriptId: string, references: readonly DetectedReference[]): void {
  db.transaction((tx) => {
    tombstoneDetectedReferences(tx, transcriptId);
    insertReferences(tx, transcriptId, references);
  });
}

/** Soft-delete a transcript and its detected references; segments are removed. */
export function deleteTranscript(db: AppDatabase, transcriptId: string): void {
  db.transaction((tx) => {
    tx.delete(transcriptSegments).where(eq(transcriptSegments.transcriptId, transcriptId)).run();
    tombstoneDetectedReferences(tx, transcriptId);
    tx.update(transcripts)
      .set({ ...tombstone(transcripts.version), text: null })
      .where(eq(transcripts.id, transcriptId))
      .run();
    enqueueChange(tx, 'transcript', transcriptId, 'delete');
  });
}

/** Record where a recording part's cloud copy is (or that there is none). */
export function setRecordingCloudState(db: AppDatabase, recordingId: string, cloudStatus: CloudStatus, cloudPath: string | null): void {
  db.transaction((tx) => {
    tx.update(sermonRecordings)
      .set({ cloudStatus, cloudPath, ...touch(sermonRecordings.version) })
      .where(eq(sermonRecordings.id, recordingId))
      .run();
    enqueueChange(tx, 'sermon_recording', recordingId);
  });
}
