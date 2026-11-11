/**
 * Search linkable items for the link picker. Plain local text search (LIKE, wildcards escaped);
 * no query lists the most recently updated items of each type.
 */
import { and, desc, isNull, ne, or, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

import {
  actionItems,
  journalEntries,
  prayerEntries,
  savedVerses,
  sermonSeries,
  sermons,
  verseNotes,
  type LinkableType,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import { entityKey, resolveEntities, type EntityRef, type ResolvedEntity } from './resolve';
import { containsText, normalizeSearchTerm } from './text-search';

export interface LinkSearchOptions {
  query: string;
  types: readonly LinkableType[];
  exclude?: EntityRef | null;
  limitPerType?: number;
}

export interface LinkSearchSection {
  type: LinkableType;
  title: string;
  data: ResolvedEntity[];
}

export const DEFAULT_RESULTS_PER_TYPE = 20;

export const LINK_SECTION_TITLES: Readonly<Record<LinkableType, string>> = {
  sermon: 'Sermons',
  sermon_series: 'Sermon series',
  journal_entry: 'Journal entries',
  prayer_entry: 'Prayers',
  action_item: 'Action items',
  verse_note: 'Bible notes',
  saved_verse: 'Saved verses',
};

interface SearchSpec {
  table: SQLiteTable;
  id: SQLiteColumn;
  deletedAt: SQLiteColumn;
  updatedAt: SQLiteColumn;
  /** Columns matched by the query; empty means the type isn't text-searchable. */
  fields: readonly SQLiteColumn[];
}

const SPECS: Readonly<Record<LinkableType, SearchSpec>> = {
  sermon: {
    table: sermons,
    id: sermons.id,
    deletedAt: sermons.deletedAt,
    updatedAt: sermons.updatedAt,
    fields: [sermons.title, sermons.speaker, sermons.church, sermons.mainPassage],
  },
  sermon_series: {
    table: sermonSeries,
    id: sermonSeries.id,
    deletedAt: sermonSeries.deletedAt,
    updatedAt: sermonSeries.updatedAt,
    fields: [sermonSeries.title, sermonSeries.speaker, sermonSeries.description],
  },
  journal_entry: {
    table: journalEntries,
    id: journalEntries.id,
    deletedAt: journalEntries.deletedAt,
    updatedAt: journalEntries.updatedAt,
    fields: [journalEntries.title, journalEntries.content],
  },
  prayer_entry: {
    table: prayerEntries,
    id: prayerEntries.id,
    deletedAt: prayerEntries.deletedAt,
    updatedAt: prayerEntries.updatedAt,
    fields: [prayerEntries.title, prayerEntries.content, prayerEntries.category],
  },
  action_item: {
    table: actionItems,
    id: actionItems.id,
    deletedAt: actionItems.deletedAt,
    updatedAt: actionItems.updatedAt,
    fields: [actionItems.title, actionItems.notes],
  },
  verse_note: {
    table: verseNotes,
    id: verseNotes.id,
    deletedAt: verseNotes.deletedAt,
    updatedAt: verseNotes.updatedAt,
    fields: [verseNotes.content],
  },
  saved_verse: {
    table: savedVerses,
    id: savedVerses.id,
    deletedAt: savedVerses.deletedAt,
    updatedAt: savedVerses.updatedAt,
    fields: [],
  },
};

function findIds(db: AppDatabase, type: LinkableType, query: string, exclude: EntityRef | null, limit: number): string[] {
  const spec = SPECS[type];
  if (query && spec.fields.length === 0) return [];
  const conditions: (SQL | undefined)[] = [
    isNull(spec.deletedAt),
    exclude && exclude.type === type ? ne(spec.id, exclude.id) : undefined,
    query ? or(...spec.fields.map((field) => containsText(field, query))) : undefined,
  ];
  return db
    .select({ id: spec.id })
    .from(spec.table)
    .where(and(...conditions))
    .orderBy(desc(spec.updatedAt))
    .limit(limit)
    .all()
    .map((row) => String(row.id));
}

export function searchLinkables(db: AppDatabase, options: LinkSearchOptions): LinkSearchSection[] {
  const query = normalizeSearchTerm(options.query);
  const limit = options.limitPerType ?? DEFAULT_RESULTS_PER_TYPE;
  const found = options.types.map((type) => ({ type, ids: findIds(db, type, query, options.exclude ?? null, limit) }));
  const resolved = resolveEntities(
    db,
    found.flatMap(({ type, ids }) => ids.map((id) => ({ type, id }))),
  );

  return found.flatMap(({ type, ids }) => {
    const data = ids.flatMap((id) => resolved.get(entityKey({ type, id })) ?? []);
    return data.length > 0 ? [{ type, title: LINK_SECTION_TITLES[type], data }] : [];
  });
}
