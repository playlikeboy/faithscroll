/**
 * Resolve linkable entities (any `LINKABLE_TYPES`) to a display title + subtitle.
 * Deleted or missing entities resolve to nothing, so dangling links simply disappear from lists.
 */
import { and, inArray, isNull } from 'drizzle-orm';

import type { IconName } from '@/components/ui';
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
import { formatCalendarDate } from '@/features/journal/dates';
import { excerpt } from '@/features/journal/plain-text';
import { JOURNAL_TYPE_LABELS } from '@/features/journal/types';
import { PRAYER_STATUS_LABELS } from '@/features/prayers/types';

import { describeVerseRange } from './reference-text';

export interface EntityRef {
  type: LinkableType;
  id: string;
}

export interface ResolvedEntity extends EntityRef {
  title: string;
  subtitle: string | null;
}

export const LINK_TYPE_LABELS: Readonly<Record<LinkableType, string>> = {
  sermon: 'Sermon',
  sermon_series: 'Sermon series',
  journal_entry: 'Journal entry',
  prayer_entry: 'Prayer',
  action_item: 'Action item',
  verse_note: 'Bible note',
  saved_verse: 'Saved verse',
};

export const LINK_TYPE_ICONS: Readonly<Record<LinkableType, IconName>> = {
  sermon: 'sermons',
  sermon_series: 'list',
  journal_entry: 'journal',
  prayer_entry: 'prayer',
  action_item: 'action',
  verse_note: 'note',
  saved_verse: 'bookmark',
};

const SHORT_EXCERPT = 60;

export function entityKey(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`;
}

function joinParts(parts: readonly (string | null | undefined)[]): string | null {
  const text = parts.filter((part): part is string => !!part && part.trim().length > 0).join(' · ');
  return text || null;
}

export function journalEntryTitle(entry: { title: string; content: string }): string {
  return entry.title.trim() || excerpt(entry.content, SHORT_EXCERPT) || 'Untitled entry';
}

type Resolver = (db: AppDatabase, ids: string[]) => ResolvedEntity[];

const RESOLVERS: Readonly<Record<LinkableType, Resolver>> = {
  sermon: (db, ids) =>
    db
      .select()
      .from(sermons)
      .where(and(inArray(sermons.id, ids), isNull(sermons.deletedAt)))
      .all()
      .map((row) => ({
        type: 'sermon',
        id: row.id,
        title: row.title.trim() || 'Untitled sermon',
        subtitle: joinParts([row.speaker, row.sermonDate ? formatCalendarDate(row.sermonDate) : null]),
      })),
  sermon_series: (db, ids) =>
    db
      .select()
      .from(sermonSeries)
      .where(and(inArray(sermonSeries.id, ids), isNull(sermonSeries.deletedAt)))
      .all()
      .map((row) => ({ type: 'sermon_series', id: row.id, title: row.title, subtitle: joinParts(['Series', row.speaker]) })),
  journal_entry: (db, ids) =>
    db
      .select()
      .from(journalEntries)
      .where(and(inArray(journalEntries.id, ids), isNull(journalEntries.deletedAt)))
      .all()
      .map((row) => ({
        type: 'journal_entry',
        id: row.id,
        title: journalEntryTitle(row),
        subtitle: joinParts([JOURNAL_TYPE_LABELS[row.entryType], formatCalendarDate(row.entryDate)]),
      })),
  prayer_entry: (db, ids) =>
    db
      .select()
      .from(prayerEntries)
      .where(and(inArray(prayerEntries.id, ids), isNull(prayerEntries.deletedAt)))
      .all()
      .map((row) => ({
        type: 'prayer_entry',
        id: row.id,
        title: row.title.trim() || 'Untitled prayer',
        subtitle: joinParts([PRAYER_STATUS_LABELS[row.status], row.category]),
      })),
  action_item: (db, ids) =>
    db
      .select()
      .from(actionItems)
      .where(and(inArray(actionItems.id, ids), isNull(actionItems.deletedAt)))
      .all()
      .map((row) => ({
        type: 'action_item',
        id: row.id,
        title: row.title,
        subtitle: row.completedAt ? 'Done' : 'Action item',
      })),
  verse_note: (db, ids) =>
    db
      .select()
      .from(verseNotes)
      .where(and(inArray(verseNotes.id, ids), isNull(verseNotes.deletedAt)))
      .all()
      .map((row) => ({
        type: 'verse_note',
        id: row.id,
        title: describeVerseRange(row.startVerseId, row.endVerseId),
        subtitle: joinParts(['Bible note', excerpt(row.content, SHORT_EXCERPT)]),
      })),
  saved_verse: (db, ids) =>
    db
      .select()
      .from(savedVerses)
      .where(and(inArray(savedVerses.id, ids), isNull(savedVerses.deletedAt)))
      .all()
      .map((row) => ({
        type: 'saved_verse',
        id: row.id,
        title: describeVerseRange(row.startVerseId, row.endVerseId),
        subtitle: 'Saved verse',
      })),
};

/** Resolve many refs with one query per type. Keyed by `entityKey`. */
export function resolveEntities(db: AppDatabase, refs: readonly EntityRef[]): Map<string, ResolvedEntity> {
  const idsByType = new Map<LinkableType, string[]>();
  for (const ref of refs) idsByType.set(ref.type, [...(idsByType.get(ref.type) ?? []), ref.id]);

  const resolved = new Map<string, ResolvedEntity>();
  for (const [type, ids] of idsByType) {
    for (const entity of RESOLVERS[type](db, [...new Set(ids)])) resolved.set(entityKey(entity), entity);
  }
  return resolved;
}

export function resolveEntity(db: AppDatabase, ref: EntityRef): ResolvedEntity | null {
  return resolveEntities(db, [ref]).get(entityKey(ref)) ?? null;
}
