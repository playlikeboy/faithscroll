/** Sermon series persistence (transactions + outbox + soft deletes). */
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { sermons, sermonSeries } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { fromVerseId } from '@/features/bible/verse-id';
import { newId } from '@/lib/ids';

import { cleanText } from './format';
import { matchAllTerms } from './search';
import type { SeriesInput, SeriesListItem, SeriesRow } from './types';

export function getSeries(db: AppDatabase, id: string): SeriesRow | null {
  return db.select().from(sermonSeries).where(and(eq(sermonSeries.id, id), isNull(sermonSeries.deletedAt))).get() ?? null;
}

export function createSeries(db: AppDatabase, input: SeriesInput): SeriesRow {
  const title = cleanText(input.title);
  if (!title) throw new Error('Series title is required');
  const id = newId();
  return db.transaction((tx) => {
    tx.insert(sermonSeries)
      .values({
        id,
        title,
        description: cleanText(input.description),
        speaker: cleanText(input.speaker),
        church: cleanText(input.church),
      })
      .run();
    enqueueChange(tx, 'sermon_series', id, 'upsert');
    const created = tx.select().from(sermonSeries).where(eq(sermonSeries.id, id)).get();
    if (!created) throw new Error('Series could not be saved');
    return created;
  });
}

/** Update provided fields; a blank title is ignored (a series always keeps a title). */
export function updateSeries(db: AppDatabase, id: string, changes: SeriesInput): SeriesRow | null {
  if (!getSeries(db, id)) return null;
  const title = changes.title === undefined ? undefined : cleanText(changes.title);
  const set = {
    ...(title && { title }),
    ...(changes.description !== undefined && { description: cleanText(changes.description) }),
    ...(changes.speaker !== undefined && { speaker: cleanText(changes.speaker) }),
    ...(changes.church !== undefined && { church: cleanText(changes.church) }),
  };
  return db.transaction((tx) => {
    tx.update(sermonSeries)
      .set({ ...set, ...touch(sermonSeries.version) })
      .where(eq(sermonSeries.id, id))
      .run();
    enqueueChange(tx, 'sermon_series', id, 'upsert');
    return tx.select().from(sermonSeries).where(eq(sermonSeries.id, id)).get() ?? null;
  });
}

/** Soft-delete a series and detach its sermons (the sermons themselves are kept). */
export function deleteSeries(db: AppDatabase, id: string): void {
  if (!getSeries(db, id)) return;
  db.transaction((tx) => {
    const members = tx
      .select({ id: sermons.id })
      .from(sermons)
      .where(and(eq(sermons.seriesId, id), isNull(sermons.deletedAt)))
      .all();
    members.forEach((member) => {
      tx.update(sermons)
        .set({ seriesId: null, ...touch(sermons.version) })
        .where(eq(sermons.id, member.id))
        .run();
      enqueueChange(tx, 'sermon', member.id, 'upsert');
    });
    tx.update(sermonSeries).set(tombstone(sermonSeries.version)).where(eq(sermonSeries.id, id)).run();
    enqueueChange(tx, 'sermon_series', id, 'delete');
  });
}

const liveSermonsOf = sql`from sermons s where s.series_id = ${sermonSeries.id} and s.deleted_at is null`;

/** Series with live sermon counts and the date span of their sermons (most recent first). */
export function listSeries(db: AppDatabase, options: { query?: string } = {}): SeriesListItem[] {
  return db
    .select({
      id: sermonSeries.id,
      title: sermonSeries.title,
      description: sermonSeries.description,
      speaker: sermonSeries.speaker,
      church: sermonSeries.church,
      createdAt: sermonSeries.createdAt,
      updatedAt: sermonSeries.updatedAt,
      deletedAt: sermonSeries.deletedAt,
      version: sermonSeries.version,
      sermonCount: sql<number>`(select count(*) ${liveSermonsOf})`.mapWith(Number),
      firstSermonDate: sql<string | null>`(select min(s.sermon_date) ${liveSermonsOf})`,
      lastSermonDate: sql<string | null>`(select max(s.sermon_date) ${liveSermonsOf})`,
    })
    .from(sermonSeries)
    .where(and(isNull(sermonSeries.deletedAt), matchAllTerms(options.query, [sermonSeries.title, sermonSeries.speaker, sermonSeries.church])))
    .orderBy(sql`(select max(coalesce(s.sermon_date, substr(s.created_at, 1, 10))) ${liveSermonsOf}) desc nulls last`, asc(sermonSeries.title))
    .all();
}

/** Return the live series whose title matches (case-insensitive), creating it when absent. */
export function findOrCreateSeries(db: AppDatabase, title: string): SeriesRow {
  const clean = cleanText(title);
  if (!clean) throw new Error('Series title is required');
  const existing = db
    .select()
    .from(sermonSeries)
    .where(and(isNull(sermonSeries.deletedAt), sql`lower(${sermonSeries.title}) = lower(${clean})`))
    .get();
  return existing ?? createSeries(db, { title: clean });
}

/** Bible book ids discussed in a series, derived from its sermons' main passages (canonical order). */
export function seriesBookIds(db: AppDatabase, seriesId: string): number[] {
  const rows = db
    .select({ start: sermons.mainPassageStartVerseId, end: sermons.mainPassageEndVerseId })
    .from(sermons)
    .where(and(eq(sermons.seriesId, seriesId), isNull(sermons.deletedAt), isNotNull(sermons.mainPassageStartVerseId)))
    .all();
  const books = new Set<number>();
  rows.forEach(({ start, end }) => {
    if (start === null) return;
    const first = fromVerseId(start).bookId;
    const last = end === null ? first : fromVerseId(end).bookId;
    for (let book = first; book <= Math.max(first, last); book += 1) books.add(book);
  });
  return [...books].sort((a, b) => a - b);
}
