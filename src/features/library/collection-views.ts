/** Collections with counts and resolved items (titles + links for every linkable type). */
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Href } from 'expo-router';

import { collectionItems, collections, savedVerses, type LinkableType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { entityKey, resolveEntities } from '@/features/links/resolve';
import { linkedItemHref, passageHref } from '@/features/links/routes';

export const COLLECTION_TABLES = [
  'collections',
  'collection_items',
  'sermons',
  'sermon_series',
  'journal_entries',
  'prayer_entries',
  'action_items',
  'verse_notes',
  'saved_verses',
] as const;

export interface CollectionSummary {
  id: string;
  title: string;
  description: string | null;
  itemCount: number;
}

export interface CollectionEntry {
  itemId: string;
  entityType: LinkableType;
  entityId: string;
  title: string;
  subtitle: string | null;
  href: Href;
}

export interface CollectionDetail {
  id: string;
  title: string;
  description: string | null;
  entries: CollectionEntry[];
}

/** Collections alphabetically, each with the number of items that still exist. */
export function listCollectionSummaries(db: AppDatabase): CollectionSummary[] {
  const rows = db
    .select({ id: collections.id, title: collections.title, description: collections.description })
    .from(collections)
    .where(isNull(collections.deletedAt))
    .orderBy(asc(sql`lower(${collections.title})`))
    .all();
  const counts = db
    .select({ collectionId: collectionItems.collectionId, value: count() })
    .from(collectionItems)
    .where(isNull(collectionItems.deletedAt))
    .groupBy(collectionItems.collectionId)
    .all();
  const byId = new Map(counts.map((row) => [row.collectionId, row.value]));
  return rows.map((row) => ({ ...row, itemCount: byId.get(row.id) ?? 0 }));
}

function savedVerseHrefs(db: AppDatabase, ids: string[]): Map<string, Href> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: savedVerses.id, start: savedVerses.startVerseId })
    .from(savedVerses)
    .where(and(inArray(savedVerses.id, ids), isNull(savedVerses.deletedAt)))
    .all();
  return new Map(rows.map((row) => [row.id, passageHref(row.start)]));
}

/** A collection with its items resolved; items whose target was deleted are left out. */
export function getCollectionDetail(db: AppDatabase, collectionId: string): CollectionDetail | null {
  const collection = db
    .select()
    .from(collections)
    .where(and(eq(collections.id, collectionId), isNull(collections.deletedAt)))
    .get();
  if (!collection) return null;
  const items = db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.collectionId, collectionId), isNull(collectionItems.deletedAt)))
    .orderBy(asc(collectionItems.sortOrder))
    .all();
  const resolved = resolveEntities(
    db,
    items.map((item) => ({ type: item.entityType, id: item.entityId })),
  );
  const verseHrefs = savedVerseHrefs(
    db,
    items.filter((item) => item.entityType === 'saved_verse').map((item) => item.entityId),
  );
  const entries = items.flatMap((item) => {
    const entity = resolved.get(entityKey({ type: item.entityType, id: item.entityId }));
    if (!entity) return [];
    const verseHref = item.entityType === 'saved_verse' ? verseHrefs.get(item.entityId) : undefined;
    const href = verseHref ?? linkedItemHref(item.entityType, item.entityId);
    return [{ itemId: item.id, entityType: item.entityType, entityId: item.entityId, title: entity.title, subtitle: entity.subtitle, href }];
  });
  return { id: collection.id, title: collection.title, description: collection.description, entries };
}
