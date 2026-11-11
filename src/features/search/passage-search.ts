/**
 * Bible-reference results: when the query parses as a passage ("Romans 8:28", "Matt 18"),
 * offer to open it and list every personal item that references or annotates it.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import type { Href } from 'expo-router';

import {
  highlights,
  savedVerses,
  scriptureReferences,
  sermonBookmarks,
  sermonNotes,
  sermons,
  transcripts,
  verseNotes,
  type LinkableType,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { parseReference } from '@/features/bible/reference';
import type { VerseRange } from '@/features/bible/types';
import { rangeToIds } from '@/features/bible/verse-id';
import { entityKey, resolveEntities, type EntityRef } from '@/features/links/resolve';
import { describeVerseRange } from '@/features/links/reference-text';
import { linkedItemHref, passageHref } from '@/features/links/routes';

import type { PassageResult, SearchResult, SearchResultType } from './types';

const MAX_RELATED = 50;

type RefRow = { sourceType: (typeof scriptureReferences.$inferSelect)['sourceType']; sourceId: string };

/** Map sermon sub-entities (notes, transcripts, bookmarks) to their sermon id. */
function sermonIdsFor(db: AppDatabase, rows: readonly RefRow[]): Map<string, string> {
  const result = new Map<string, string>();
  const idsOf = (type: RefRow['sourceType']) => rows.filter((row) => row.sourceType === type).map((row) => row.sourceId);
  const lookups = [
    { ids: idsOf('sermon_note'), table: sermonNotes },
    { ids: idsOf('transcript'), table: transcripts },
    { ids: idsOf('sermon_bookmark'), table: sermonBookmarks },
  ] as const;
  for (const { ids, table } of lookups) {
    if (ids.length === 0) continue;
    const found = db
      .select({ id: table.id, sermonId: table.sermonId })
      .from(table)
      .where(and(inArray(table.id, ids), isNull(table.deletedAt)))
      .all();
    for (const row of found) result.set(row.id, row.sermonId);
  }
  return result;
}

function referencedEntities(db: AppDatabase, start: number, end: number): EntityRef[] {
  const rows = db
    .select({ sourceType: scriptureReferences.sourceType, sourceId: scriptureReferences.sourceId })
    .from(scriptureReferences)
    .where(
      and(
        isNull(scriptureReferences.deletedAt),
        lte(scriptureReferences.startVerseId, end),
        gte(scriptureReferences.endVerseId, start),
      ),
    )
    .orderBy(desc(scriptureReferences.updatedAt))
    .limit(MAX_RELATED * 2)
    .all();
  const sermonOf = sermonIdsFor(db, rows);
  return rows.flatMap((row): EntityRef[] => {
    switch (row.sourceType) {
      case 'sermon':
      case 'journal_entry':
      case 'prayer_entry':
      case 'action_item':
        return [{ type: row.sourceType, id: row.sourceId }];
      default: {
        const sermonId = sermonOf.get(row.sourceId);
        return sermonId ? [{ type: 'sermon', id: sermonId }] : [];
      }
    }
  });
}

function overlappingSermons(db: AppDatabase, start: number, end: number): EntityRef[] {
  return db
    .select({ id: sermons.id })
    .from(sermons)
    .where(
      and(
        isNull(sermons.deletedAt),
        isNotNull(sermons.mainPassageStartVerseId),
        lte(sermons.mainPassageStartVerseId, end),
        gte(sermons.mainPassageEndVerseId, start),
      ),
    )
    .all()
    .map((row) => ({ type: 'sermon' as const, id: row.id }));
}

function overlappingAnnotations(db: AppDatabase, start: number, end: number): EntityRef[] {
  const overlap = <T extends typeof verseNotes | typeof savedVerses>(table: T) =>
    and(isNull(table.deletedAt), lte(table.startVerseId, end), gte(table.endVerseId, start));
  const notes = db.select({ id: verseNotes.id }).from(verseNotes).where(overlap(verseNotes)).orderBy(asc(verseNotes.startVerseId)).all();
  const saved = db.select({ id: savedVerses.id }).from(savedVerses).where(overlap(savedVerses)).orderBy(asc(savedVerses.startVerseId)).all();
  return [
    ...notes.map((row) => ({ type: 'verse_note' as LinkableType, id: row.id })),
    ...saved.map((row) => ({ type: 'saved_verse' as LinkableType, id: row.id })),
  ];
}

function highlightResults(db: AppDatabase, start: number, end: number): SearchResult[] {
  return db
    .select({ id: highlights.id, verseId: highlights.verseId, color: highlights.color })
    .from(highlights)
    .where(and(isNull(highlights.deletedAt), gte(highlights.verseId, start), lte(highlights.verseId, end)))
    .orderBy(asc(highlights.verseId))
    .all()
    .map((row) => ({
      type: 'highlight' as const,
      id: row.id,
      title: describeVerseRange(row.verseId),
      subtitle: `Highlighted (${row.color})`,
      snippet: null,
      href: passageHref(row.verseId),
    }));
}

function toResult(ref: EntityRef, title: string, subtitle: string | null, db: AppDatabase): SearchResult {
  const type = ref.type as SearchResultType;
  const href: Href = ref.type === 'saved_verse' ? savedVerseHref(db, ref.id) : linkedItemHref(ref.type, ref.id);
  return { type, id: ref.id, title, subtitle, snippet: null, href };
}

function savedVerseHref(db: AppDatabase, id: string): Href {
  const row = db.select({ start: savedVerses.startVerseId }).from(savedVerses).where(eq(savedVerses.id, id)).get();
  return row ? passageHref(row.start) : ('/library/saved' as Href);
}

/** Personal items linked to a passage: references, sermons on it, notes, saved verses and highlights. */
export function findPassageRelated(db: AppDatabase, range: VerseRange): SearchResult[] {
  const { startVerseId, endVerseId } = rangeToIds(range);
  const refs = [
    ...referencedEntities(db, startVerseId, endVerseId),
    ...overlappingSermons(db, startVerseId, endVerseId),
    ...overlappingAnnotations(db, startVerseId, endVerseId),
  ];
  const unique = [...new Map(refs.map((ref) => [entityKey(ref), ref])).values()];
  const resolved = resolveEntities(db, unique);
  const linked = unique.flatMap((ref) => {
    const entity = resolved.get(entityKey(ref));
    return entity ? [toResult(ref, entity.title, entity.subtitle, db)] : [];
  });
  return [...linked, ...highlightResults(db, startVerseId, endVerseId)].slice(0, MAX_RELATED);
}

/** A passage result when the query is a Bible reference, otherwise null. */
export function searchPassage(db: AppDatabase, query: string): PassageResult | null {
  const range = parseReference(query);
  if (!range) return null;
  const { startVerseId, endVerseId } = rangeToIds(range);
  return {
    range,
    reference: describeVerseRange(startVerseId, endVerseId),
    href: passageHref(startVerseId),
    related: findPassageRelated(db, range),
  };
}
