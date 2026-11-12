/**
 * Universal search across personal content (local SQLite only — nothing leaves the device).
 * Each query word also matches close synonyms from the offline concept map ("anxiety" → worry…).
 */
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Href } from 'expo-router';

import { entityTags, highlights, savedVerses, tags } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { searchBible } from '@/features/bible/repository';
import type { BibleSearchOptions, BibleSearchResult } from '@/features/bible/types';
import { describeVerseRange } from '@/features/links/reference-text';
import { passageHref } from '@/features/links/routes';

import { searchPassage } from './passage-search';
import { isPersonalType, PERSONAL_TYPES, searchPersonalGroup } from './personal-search';
import { contains, expandTerms, isSearchable, normalizeQuery, splitTerms, type TermGroup } from './query';
import { expandQuery, synonymsFor } from './semantic/expand';
import { GROUP_LABELS, type SearchGroup, type SearchResponse, type SearchResult, type SearchResultType, type TagResult } from './types';

export const DEFAULT_GROUP_SIZE = 5;
const MAX_TAGS = 10;
const BIBLE_MATCH_LIMIT = 300;

function searchTags(db: AppDatabase, terms: string[]): TagResult[] {
  if (terms.length === 0) return [];
  const rows = db
    .select({ id: tags.id, name: tags.name, itemCount: count(entityTags.entityId) })
    .from(tags)
    .leftJoin(entityTags, eq(entityTags.tagId, tags.id))
    .where(and(isNull(tags.deletedAt), sql.join(terms.map((term) => contains(tags.name, term)), sql` and `)))
    .groupBy(tags.id)
    .orderBy(asc(sql`lower(${tags.name})`))
    .limit(MAX_TAGS)
    .all();
  return rows;
}

/** The query's terms, each with its synonyms. */
export function termGroupsFor(query: string): TermGroup[] {
  return expandTerms(splitTerms(query), synonymsFor);
}

/** First page of every group, plus a passage result and matching tags. Empty groups are omitted. */
export function searchLibrary(db: AppDatabase, rawQuery: string, groupSize: number = DEFAULT_GROUP_SIZE): SearchResponse {
  const query = normalizeQuery(rawQuery);
  const passage = query ? searchPassage(db, query) : null;
  if (!isSearchable(query)) {
    return { query, terms: [], alsoSearching: [], passage, groups: [], tags: [], total: passage ? 1 + passage.related.length : 0 };
  }
  const terms = splitTerms(query);
  const termGroups = termGroupsFor(query);
  const groups = PERSONAL_TYPES.map((type) => searchPersonalGroup(db, type, termGroups, { limit: groupSize, offset: 0 })).filter(
    (group) => group.results.length > 0,
  );
  const tagResults = searchTags(db, terms);
  const total =
    groups.reduce((sum, group) => sum + group.results.length, 0) + tagResults.length + (passage ? 1 + passage.related.length : 0);
  const alsoSearching = passage ? [] : expandQuery(query).alsoSearching;
  return { query, terms, alsoSearching, passage, groups, tags: tagResults, total };
}

/** Next page for one group ("Show more"). */
export function searchMore(db: AppDatabase, type: SearchResultType, rawQuery: string, offset: number, limit: number = 20): SearchGroup {
  if (!isPersonalType(type)) return { type, label: GROUP_LABELS[type], results: [], hasMore: false };
  return searchPersonalGroup(db, type, termGroupsFor(normalizeQuery(rawQuery)), { limit, offset });
}

export type BibleSearchFn = (query: string, options?: BibleSearchOptions) => Promise<BibleSearchResult[]>;

/**
 * Saved verses and highlights whose Scripture text contains the words (e.g. "forgiveness"),
 * using the bundled Bible's full-text search. Async because Bible text lives in its own database.
 */
export async function searchSavedScripture(
  db: AppDatabase,
  rawQuery: string,
  bibleSearch: BibleSearchFn = searchBible,
): Promise<SearchResult[]> {
  const query = normalizeQuery(rawQuery);
  if (!isSearchable(query)) return [];
  const matches = await bibleSearch(query, { limit: BIBLE_MATCH_LIMIT });
  const verseIds = new Set(matches.map((match) => match.verse.id));
  if (verseIds.size === 0) return [];
  const snippets = new Map(matches.map((match) => [match.verse.id, match.verse.text]));

  const saved = db.select().from(savedVerses).where(isNull(savedVerses.deletedAt)).orderBy(asc(savedVerses.startVerseId)).all();
  const savedResults = saved.flatMap((row): SearchResult[] => {
    const hit = [...verseIds].find((id) => id >= row.startVerseId && id <= row.endVerseId);
    if (hit === undefined) return [];
    return [
      {
        type: 'saved_verse',
        id: row.id,
        title: describeVerseRange(row.startVerseId, row.endVerseId),
        subtitle: 'Saved verse',
        snippet: snippets.get(hit) ?? null,
        href: passageHref(row.startVerseId),
      },
    ];
  });
  const highlighted = db
    .select({ id: highlights.id, verseId: highlights.verseId, color: highlights.color })
    .from(highlights)
    .where(and(isNull(highlights.deletedAt), inArray(highlights.verseId, [...verseIds])))
    .orderBy(asc(highlights.verseId))
    .all()
    .map((row) => ({
      type: 'highlight' as const,
      id: row.id,
      title: describeVerseRange(row.verseId),
      subtitle: `Highlighted (${row.color})`,
      snippet: snippets.get(row.verseId) ?? null,
      href: passageHref(row.verseId) as Href,
    }));
  return [...savedResults, ...highlighted];
}
