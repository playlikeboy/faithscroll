/**
 * Recording parts. A sermon's audio is stored as one or more parts (checkpointed every few minutes and on
 * every pause) so a crash can only ever put the part being written at risk. Files live in the document
 * directory `recordings/` folder; only the relative file name is stored.
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { sermonBookmarks, sermonRecordings } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import { cleanText } from './format';
import type { RecordingRow, RecordingStatus } from './types';

export const RECORDING_MIME_TYPE = 'audio/mp4';
export const PLAYABLE_STATUSES: readonly RecordingStatus[] = ['saved', 'interrupted'];
export const UNFINISHED_STATUSES: readonly RecordingStatus[] = ['recording', 'paused'];

export interface NewRecordingPart {
  sermonId: string;
  /** Optional pre-generated id (the file name is usually derived from it). */
  id?: string;
  localFileName: string;
  mimeType?: string;
  startedAt?: string;
}

export interface RecordingPatch {
  status?: RecordingStatus;
  durationMs?: number;
  sizeBytes?: number | null;
  endedAt?: string | null;
  localFileName?: string | null;
}

export function getRecording(db: AppDatabase, id: string): RecordingRow | null {
  return db.select().from(sermonRecordings).where(and(eq(sermonRecordings.id, id), isNull(sermonRecordings.deletedAt))).get() ?? null;
}

export function createRecordingPart(db: AppDatabase, part: NewRecordingPart): RecordingRow {
  const id = part.id ?? newId();
  return db.transaction((tx) => {
    tx.insert(sermonRecordings)
      .values({
        id,
        sermonId: part.sermonId,
        localFileName: part.localFileName,
        mimeType: part.mimeType ?? RECORDING_MIME_TYPE,
        status: 'recording',
        startedAt: part.startedAt ?? nowIso(),
      })
      .run();
    enqueueChange(tx, 'sermon_recording', id, 'upsert');
    const created = tx.select().from(sermonRecordings).where(eq(sermonRecordings.id, id)).get();
    if (!created) throw new Error('Recording could not be saved');
    return created;
  });
}

export function updateRecording(db: AppDatabase, id: string, patch: RecordingPatch): RecordingRow | null {
  if (!getRecording(db, id)) return null;
  const set = {
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.durationMs !== undefined && { durationMs: Math.max(0, Math.round(patch.durationMs)) }),
    ...(patch.sizeBytes !== undefined && { sizeBytes: patch.sizeBytes }),
    ...(patch.endedAt !== undefined && { endedAt: patch.endedAt }),
    ...(patch.localFileName !== undefined && { localFileName: patch.localFileName }),
  };
  return db.transaction((tx) => {
    tx.update(sermonRecordings)
      .set({ ...set, ...touch(sermonRecordings.version) })
      .where(eq(sermonRecordings.id, id))
      .run();
    enqueueChange(tx, 'sermon_recording', id, 'upsert');
    return tx.select().from(sermonRecordings).where(eq(sermonRecordings.id, id)).get() ?? null;
  });
}

/** Rename a part; a blank title clears it (the UI then shows "Part N"). */
export function renameRecording(db: AppDatabase, id: string, title: string | null): RecordingRow | null {
  if (!getRecording(db, id)) return null;
  return db.transaction((tx) => {
    tx.update(sermonRecordings)
      .set({ title: cleanText(title), ...touch(sermonRecordings.version) })
      .where(eq(sermonRecordings.id, id))
      .run();
    enqueueChange(tx, 'sermon_recording', id, 'upsert');
    return tx.select().from(sermonRecordings).where(eq(sermonRecordings.id, id)).get() ?? null;
  });
}

/** Soft-delete a part and the bookmarks captured in it. Returns the file name to remove from disk. */
export function deleteRecording(db: AppDatabase, id: string): { localFileName: string | null } {
  const existing = getRecording(db, id);
  if (!existing) return { localFileName: null };
  db.transaction((tx) => {
    const bookmarks = tx
      .select({ id: sermonBookmarks.id })
      .from(sermonBookmarks)
      .where(and(eq(sermonBookmarks.recordingId, id), isNull(sermonBookmarks.deletedAt)))
      .all();
    if (bookmarks.length > 0) {
      const ids = bookmarks.map((b) => b.id);
      tx.update(sermonBookmarks).set(tombstone(sermonBookmarks.version)).where(inArray(sermonBookmarks.id, ids)).run();
      ids.forEach((bookmarkId) => enqueueChange(tx, 'sermon_bookmark', bookmarkId, 'delete'));
    }
    tx.update(sermonRecordings).set(tombstone(sermonRecordings.version)).where(eq(sermonRecordings.id, id)).run();
    enqueueChange(tx, 'sermon_recording', id, 'delete');
  });
  return { localFileName: existing.localFileName };
}

/** All live parts of a sermon in recording order. */
export function listRecordings(db: AppDatabase, sermonId: string): RecordingRow[] {
  return db
    .select()
    .from(sermonRecordings)
    .where(and(eq(sermonRecordings.sermonId, sermonId), isNull(sermonRecordings.deletedAt)))
    .orderBy(asc(sql`coalesce(${sermonRecordings.startedAt}, ${sermonRecordings.createdAt})`), asc(sermonRecordings.createdAt))
    .all();
}

/** Parts left mid-recording (e.g. the app was terminated). Used by crash recovery. */
export function listUnfinishedRecordings(db: AppDatabase): RecordingRow[] {
  return db
    .select()
    .from(sermonRecordings)
    .where(and(isNull(sermonRecordings.deletedAt), inArray(sermonRecordings.status, [...UNFINISHED_STATUSES])))
    .all();
}

/** Total duration of a sermon's playable parts — the offset at which new audio continues the timeline. */
export function playableDurationMs(db: AppDatabase, sermonId: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${sermonRecordings.durationMs}), 0)`.mapWith(Number) })
    .from(sermonRecordings)
    .where(
      and(
        eq(sermonRecordings.sermonId, sermonId),
        isNull(sermonRecordings.deletedAt),
        inArray(sermonRecordings.status, [...PLAYABLE_STATUSES]),
      ),
    )
    .get();
  return row?.total ?? 0;
}
