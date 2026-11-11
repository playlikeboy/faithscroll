/**
 * Sermon library persistence. Every write runs in a transaction with an outbox entry
 * (`enqueueChange`) so the sync engine can push it later; deletes are soft (tombstones).
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { sermonBookmarks, sermonNotes, sermonRecaps, sermonRecordings, sermons, sermonSeries, transcripts } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { toLocalDateString } from '@/lib/time';

import { cleanText, defaultSermonTitle, isValidSermonDate } from './format';
import { matchAllTerms } from './search';
import type { AiStatus, SermonInput, SermonListItem, SermonListOptions, SermonRow } from './types';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function normalizeDate(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isValidSermonDate(trimmed)) throw new Error('Invalid sermon date');
  return trimmed;
}

function passageColumns(passage: SermonInput['mainPassage']) {
  if (!passage) return { mainPassage: null, mainPassageStartVerseId: null, mainPassageEndVerseId: null };
  return {
    mainPassage: cleanText(passage.text),
    mainPassageStartVerseId: passage.startVerseId,
    mainPassageEndVerseId: passage.endVerseId,
  };
}

export function getSermon(db: AppDatabase, id: string): SermonRow | null {
  return db.select().from(sermons).where(and(eq(sermons.id, id), isNull(sermons.deletedAt))).get() ?? null;
}

/** Create a sermon. Only the title matters, and even it falls back to "Sermon · <date>". */
export function createSermon(db: AppDatabase, input: SermonInput = {}): SermonRow {
  const sermonDate = input.sermonDate === undefined ? toLocalDateString() : normalizeDate(input.sermonDate);
  const id = newId();
  const values = {
    id,
    title: cleanText(input.title) ?? defaultSermonTitle(sermonDate),
    speaker: cleanText(input.speaker),
    church: cleanText(input.church),
    seriesId: input.seriesId ?? null,
    sermonDate,
    ...passageColumns(input.mainPassage),
  };
  return db.transaction((tx) => {
    tx.insert(sermons).values(values).run();
    enqueueChange(tx, 'sermon', id, 'upsert');
    const created = tx.select().from(sermons).where(eq(sermons.id, id)).get();
    if (!created) throw new Error('Sermon could not be saved');
    return created;
  });
}

function buildSermonChanges(existing: SermonRow, changes: SermonInput) {
  const sermonDate = changes.sermonDate === undefined ? existing.sermonDate : normalizeDate(changes.sermonDate);
  return {
    ...(changes.title !== undefined && { title: cleanText(changes.title) ?? defaultSermonTitle(sermonDate) }),
    ...(changes.speaker !== undefined && { speaker: cleanText(changes.speaker) }),
    ...(changes.church !== undefined && { church: cleanText(changes.church) }),
    ...(changes.seriesId !== undefined && { seriesId: changes.seriesId }),
    ...(changes.sermonDate !== undefined && { sermonDate }),
    ...(changes.mainPassage !== undefined && passageColumns(changes.mainPassage)),
  };
}

/** Apply the provided fields. Returns the updated sermon, or null when it does not exist. */
export function updateSermon(db: AppDatabase, id: string, changes: SermonInput): SermonRow | null {
  const existing = getSermon(db, id);
  if (!existing) return null;
  const set = buildSermonChanges(existing, changes);
  return db.transaction((tx) => {
    tx.update(sermons)
      .set({ ...set, ...touch(sermons.version) })
      .where(eq(sermons.id, id))
      .run();
    enqueueChange(tx, 'sermon', id, 'upsert');
    return tx.select().from(sermons).where(eq(sermons.id, id)).get() ?? null;
  });
}

type ChildTable = typeof sermonRecordings | typeof sermonBookmarks | typeof sermonNotes | typeof transcripts | typeof sermonRecaps;
type ChildEntity = 'sermon_recording' | 'sermon_bookmark' | 'sermon_note' | 'transcript' | 'sermon_recap';

function tombstoneChildren(tx: AppDatabase, table: ChildTable, entity: ChildEntity, sermonId: string): void {
  const rows = tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.sermonId, sermonId), isNull(table.deletedAt)))
    .all();
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.id);
  tx.update(table).set(tombstone(table.version)).where(inArray(table.id, ids)).run();
  ids.forEach((childId) => enqueueChange(tx, entity, childId, 'delete'));
}

/**
 * Soft-delete a sermon with its recordings, bookmarks, notes, transcripts and recaps.
 * Returns the local recording file names so the caller can remove the audio files.
 */
export function deleteSermon(db: AppDatabase, id: string): { recordingFileNames: string[] } {
  if (!getSermon(db, id)) return { recordingFileNames: [] };
  const files = db
    .select({ fileName: sermonRecordings.localFileName })
    .from(sermonRecordings)
    .where(and(eq(sermonRecordings.sermonId, id), isNull(sermonRecordings.deletedAt)))
    .all()
    .map((row) => row.fileName)
    .filter((name): name is string => !!name);

  db.transaction((tx) => {
    tombstoneChildren(tx, sermonBookmarks, 'sermon_bookmark', id);
    tombstoneChildren(tx, sermonRecordings, 'sermon_recording', id);
    tombstoneChildren(tx, sermonNotes, 'sermon_note', id);
    tombstoneChildren(tx, transcripts, 'transcript', id);
    tombstoneChildren(tx, sermonRecaps, 'sermon_recap', id);
    tx.update(sermons).set(tombstone(sermons.version)).where(eq(sermons.id, id)).run();
    enqueueChange(tx, 'sermon', id, 'delete');
  });
  return { recordingFileNames: files };
}

const PLAYABLE = sql.raw(`('saved', 'interrupted')`);

const listColumns = {
  id: sermons.id,
  title: sermons.title,
  speaker: sermons.speaker,
  church: sermons.church,
  seriesId: sermons.seriesId,
  seriesTitle: sermonSeries.title,
  sermonDate: sermons.sermonDate,
  mainPassage: sermons.mainPassage,
  mainPassageStartVerseId: sermons.mainPassageStartVerseId,
  mainPassageEndVerseId: sermons.mainPassageEndVerseId,
  createdAt: sermons.createdAt,
  totalDurationMs: sql<number>`coalesce((select sum(r.duration_ms) from sermon_recordings r
    where r.sermon_id = ${sermons.id} and r.deleted_at is null and r.status in ${PLAYABLE}), 0)`.mapWith(Number),
  recordingCount: sql<number>`(select count(*) from sermon_recordings r
    where r.sermon_id = ${sermons.id} and r.deleted_at is null and r.status in ${PLAYABLE})`.mapWith(Number),
  bookmarkCount: sql<number>`(select count(*) from sermon_bookmarks b
    where b.sermon_id = ${sermons.id} and b.deleted_at is null)`.mapWith(Number),
  transcriptStatus: sql<AiStatus | null>`(select t.status from transcripts t
    where t.sermon_id = ${sermons.id} and t.deleted_at is null order by t.updated_at desc limit 1)`,
  recapStatus: sql<AiStatus | null>`(select c.status from sermon_recaps c
    where c.sermon_id = ${sermons.id} and c.deleted_at is null order by c.updated_at desc limit 1)`,
};

/** Library listing with series title, total duration and transcript/recap badge statuses. */
export function listSermons(db: AppDatabase, options: SermonListOptions = {}): SermonListItem[] {
  const { query, seriesId, order = 'newest', offset = 0 } = options;
  const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const sortDate = sql`coalesce(${sermons.sermonDate}, substr(${sermons.createdAt}, 1, 10))`;
  const direction = order === 'newest' ? desc : asc;

  return db
    .select(listColumns)
    .from(sermons)
    .leftJoin(sermonSeries, and(eq(sermons.seriesId, sermonSeries.id), isNull(sermonSeries.deletedAt)))
    .where(
      and(
        isNull(sermons.deletedAt),
        seriesId ? eq(sermons.seriesId, seriesId) : undefined,
        matchAllTerms(query, [sermons.title, sermons.speaker, sermons.church, sermonSeries.title, sermons.mainPassage]),
      ),
    )
    .orderBy(direction(sortDate), direction(sermons.createdAt))
    .limit(limit)
    .offset(Math.max(0, offset))
    .all();
}
