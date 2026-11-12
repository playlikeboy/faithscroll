/**
 * LIKE-based search over personal content. Every term must match at least one field (or a tag);
 * deleted rows are excluded; results are paginated per type.
 */
import { and, asc, desc, getTableName, isNull, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Href } from 'expo-router';

import {
  actionItems,
  collections,
  entityTags,
  journalEntries,
  prayerEntries,
  prayerUpdates,
  sermonNotes,
  sermonSeries,
  sermons,
  tags,
  transcriptSegments,
  transcripts,
  verseNotes,
  type LinkableType,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { formatCalendarDate } from '@/features/journal/dates';
import { JOURNAL_TYPE_LABELS } from '@/features/journal/types';
import { journalEntryTitle } from '@/features/links/resolve';
import { describeVerseRange } from '@/features/links/reference-text';
import { PRAYER_STATUS_LABELS } from '@/features/prayers/types';

import { allTermsMatch, contains, type TermGroup } from './query';
import { firstSnippet } from './snippet';
import { GROUP_LABELS, type SearchGroup, type SearchResult, type SearchResultType } from './types';

export interface PageOptions {
  limit: number;
  offset: number;
}

type PersonalType = Exclude<SearchResultType, 'saved_verse' | 'highlight'>;

/** Display order of groups. */
export const PERSONAL_TYPES: readonly PersonalType[] = ['journal_entry', 'prayer_entry', 'sermon', 'verse_note', 'action_item', 'collection'];

function join(parts: readonly (string | null | undefined)[]): string | null {
  const text = parts.filter((part): part is string => !!part && part.trim().length > 0).join(' · ');
  return text || null;
}

/**
 * Fully qualified reference to an outer-query column for correlated subqueries.
 * Drizzle omits the table name for single-table selects, which would make "id" resolve to the
 * subquery's own table, so outer columns are always spelled out explicitly.
 */
function outer(column: SQLiteColumn): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}

function tagMatch(entityType: LinkableType, idColumn: SQLiteColumn, term: string): SQL {
  return sql`exists (select 1 from ${entityTags} inner join ${tags} on ${tags.id} = ${entityTags.tagId}
    where ${entityTags.entityType} = ${entityType} and ${entityTags.entityId} = ${outer(idColumn)}
    and ${tags.deletedAt} is null and ${contains(tags.name, term)})`;
}

function searchJournal(db: AppDatabase, terms: readonly TermGroup[], page: PageOptions): SearchResult[] {
  const rows = db
    .select()
    .from(journalEntries)
    .where(
      and(
        isNull(journalEntries.deletedAt),
        allTermsMatch(terms, (term) => [
          contains(journalEntries.title, term),
          contains(journalEntries.content, term),
          contains(journalEntries.prompt, term),
          tagMatch('journal_entry', journalEntries.id, term),
        ]),
      ),
    )
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.updatedAt))
    .limit(page.limit)
    .offset(page.offset)
    .all();
  return rows.map((row) => ({
    type: 'journal_entry',
    id: row.id,
    title: journalEntryTitle(row),
    subtitle: join([JOURNAL_TYPE_LABELS[row.entryType], formatCalendarDate(row.entryDate)]),
    snippet: firstSnippet([row.content, row.prompt], terms.flat()),
    href: `/journal/${encodeURIComponent(row.id)}` as Href,
  }));
}

function searchPrayers(db: AppDatabase, terms: readonly TermGroup[], page: PageOptions): SearchResult[] {
  const updateMatch = (term: string) => sql`exists (select 1 from ${prayerUpdates}
    where ${prayerUpdates.prayerId} = ${outer(prayerEntries.id)} and ${prayerUpdates.deletedAt} is null
    and ${contains(prayerUpdates.content, term)})`;
  const rows = db
    .select({
      row: prayerEntries,
      updateText: sql<string | null>`(select ${prayerUpdates.content} from ${prayerUpdates}
        where ${prayerUpdates.prayerId} = ${outer(prayerEntries.id)} and ${prayerUpdates.deletedAt} is null
        and ${contains(prayerUpdates.content, terms[0]?.[0] ?? '')} limit 1)`,
    })
    .from(prayerEntries)
    .where(
      and(
        isNull(prayerEntries.deletedAt),
        allTermsMatch(terms, (term) => [
          contains(prayerEntries.title, term),
          contains(prayerEntries.content, term),
          contains(prayerEntries.category, term),
          updateMatch(term),
          tagMatch('prayer_entry', prayerEntries.id, term),
        ]),
      ),
    )
    .orderBy(desc(prayerEntries.updatedAt))
    .limit(page.limit)
    .offset(page.offset)
    .all();
  return rows.map(({ row, updateText }) => ({
    type: 'prayer_entry',
    id: row.id,
    title: row.title.trim() || 'Untitled prayer',
    subtitle: join([PRAYER_STATUS_LABELS[row.status], row.category]),
    snippet: firstSnippet([row.content, updateText], terms.flat()),
    href: `/prayers/${encodeURIComponent(row.id)}` as Href,
  }));
}

function sermonConditions(term: string): SQL[] {
  return [
    contains(sermons.title, term),
    contains(sermons.speaker, term),
    contains(sermons.church, term),
    contains(sermons.mainPassage, term),
    sql`exists (select 1 from ${sermonSeries} where ${sermonSeries.id} = ${outer(sermons.seriesId)}
      and ${sermonSeries.deletedAt} is null and ${contains(sermonSeries.title, term)})`,
    sql`exists (select 1 from ${sermonNotes} where ${sermonNotes.sermonId} = ${outer(sermons.id)}
      and ${sermonNotes.deletedAt} is null and ${contains(sermonNotes.content, term)})`,
    sql`exists (select 1 from ${transcripts} where ${transcripts.sermonId} = ${outer(sermons.id)}
      and ${transcripts.deletedAt} is null and ${contains(transcripts.text, term)})`,
    sql`exists (select 1 from ${transcriptSegments} inner join ${transcripts} on ${transcripts.id} = ${transcriptSegments.transcriptId}
      where ${transcripts.sermonId} = ${outer(sermons.id)} and ${transcripts.deletedAt} is null
      and ${contains(transcriptSegments.text, term)})`,
    tagMatch('sermon', sermons.id, term),
  ];
}

function searchSermons(db: AppDatabase, terms: readonly TermGroup[], page: PageOptions): SearchResult[] {
  const first = terms[0]?.[0] ?? '';
  const rows = db
    .select({
      row: sermons,
      seriesTitle: sql<string | null>`(select ${sermonSeries.title} from ${sermonSeries}
        where ${sermonSeries.id} = ${outer(sermons.seriesId)} and ${sermonSeries.deletedAt} is null)`,
      noteText: sql<string | null>`(select ${sermonNotes.content} from ${sermonNotes}
        where ${sermonNotes.sermonId} = ${outer(sermons.id)} and ${sermonNotes.deletedAt} is null
        and ${contains(sermonNotes.content, first)} limit 1)`,
      transcriptText: sql<string | null>`(select ${transcripts.text} from ${transcripts}
        where ${transcripts.sermonId} = ${outer(sermons.id)} and ${transcripts.deletedAt} is null
        and ${contains(transcripts.text, first)} limit 1)`,
    })
    .from(sermons)
    .where(and(isNull(sermons.deletedAt), allTermsMatch(terms, sermonConditions)))
    .orderBy(asc(sql`${sermons.sermonDate} is null`), desc(sermons.sermonDate), desc(sermons.createdAt))
    .limit(page.limit)
    .offset(page.offset)
    .all();
  return rows.map(({ row, seriesTitle, noteText, transcriptText }) => ({
    type: 'sermon',
    id: row.id,
    title: row.title.trim() || 'Untitled sermon',
    subtitle: join([row.speaker, row.church, seriesTitle, row.sermonDate ? formatCalendarDate(row.sermonDate) : null]),
    snippet: firstSnippet([noteText, transcriptText], terms.flat()),
    href: `/sermons/${encodeURIComponent(row.id)}` as Href,
  }));
}

function searchVerseNotes(db: AppDatabase, terms: readonly TermGroup[], page: PageOptions): SearchResult[] {
  const rows = db
    .select()
    .from(verseNotes)
    .where(
      and(
        isNull(verseNotes.deletedAt),
        allTermsMatch(terms, (term) => [contains(verseNotes.content, term), tagMatch('verse_note', verseNotes.id, term)]),
      ),
    )
    .orderBy(desc(verseNotes.updatedAt))
    .limit(page.limit)
    .offset(page.offset)
    .all();
  return rows.map((row) => ({
    type: 'verse_note',
    id: row.id,
    title: describeVerseRange(row.startVerseId, row.endVerseId),
    subtitle: 'Bible note',
    snippet: firstSnippet([row.content], terms.flat()),
    href: `/bible/note/${encodeURIComponent(row.id)}` as Href,
  }));
}

function searchActions(db: AppDatabase, terms: readonly TermGroup[], page: PageOptions): SearchResult[] {
  const rows = db
    .select()
    .from(actionItems)
    .where(
      and(
        isNull(actionItems.deletedAt),
        allTermsMatch(terms, (term) => [
          contains(actionItems.title, term),
          contains(actionItems.notes, term),
          tagMatch('action_item', actionItems.id, term),
        ]),
      ),
    )
    .orderBy(asc(sql`${actionItems.completedAt} is not null`), desc(actionItems.createdAt))
    .limit(page.limit)
    .offset(page.offset)
    .all();
  return rows.map((row) => ({
    type: 'action_item',
    id: row.id,
    title: row.title,
    subtitle: row.completedAt ? 'Done' : 'Open',
    snippet: firstSnippet([row.notes], terms.flat()),
    href: '/library/actions' as Href,
  }));
}

function searchCollections(db: AppDatabase, terms: readonly TermGroup[], page: PageOptions): SearchResult[] {
  const rows = db
    .select()
    .from(collections)
    .where(
      and(
        isNull(collections.deletedAt),
        allTermsMatch(terms, (term) => [contains(collections.title, term), contains(collections.description, term)]),
      ),
    )
    .orderBy(asc(sql`lower(${collections.title})`))
    .limit(page.limit)
    .offset(page.offset)
    .all();
  return rows.map((row) => ({
    type: 'collection',
    id: row.id,
    title: row.title,
    subtitle: 'Collection',
    snippet: firstSnippet([row.description], terms.flat()),
    href: `/library/collections/${encodeURIComponent(row.id)}` as Href,
  }));
}

const SEARCHERS: Readonly<Record<PersonalType, (db: AppDatabase, terms: readonly TermGroup[], page: PageOptions) => SearchResult[]>> = {
  journal_entry: searchJournal,
  prayer_entry: searchPrayers,
  sermon: searchSermons,
  verse_note: searchVerseNotes,
  action_item: searchActions,
  collection: searchCollections,
};

/** One page of one result type. Fetches one extra row to know whether more exist. */
export function searchPersonalGroup(db: AppDatabase, type: PersonalType, terms: readonly TermGroup[], page: PageOptions): SearchGroup {
  if (terms.length === 0) return { type, label: GROUP_LABELS[type], results: [], hasMore: false };
  const rows = SEARCHERS[type](db, terms, { limit: page.limit + 1, offset: page.offset });
  return { type, label: GROUP_LABELS[type], results: rows.slice(0, page.limit), hasMore: rows.length > page.limit };
}

export function isPersonalType(type: SearchResultType): type is PersonalType {
  return (PERSONAL_TYPES as readonly SearchResultType[]).includes(type);
}
