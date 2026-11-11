/** Where an action item came from, as a label and a link back to it. */
import { and, inArray, isNull } from 'drizzle-orm';
import type { Href } from 'expo-router';

import { journalEntries, sermonRecaps, sermons } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { journalEntryTitle } from '@/features/links/resolve';
import { describeVerseRange } from '@/features/links/reference-text';
import { passageHref } from '@/features/links/routes';

import type { ActionItemRow } from './action-items';

export interface ActionSource {
  label: string;
  href: Href;
}

/** Verse sources are stored as "start" or "start-end" verse ids. */
export function parseVerseSource(sourceId: string | null): { start: number; end: number } | null {
  const match = /^(\d{7,9})(?:[-:](\d{7,9}))?$/.exec(sourceId ?? '');
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  return end >= start ? { start, end } : null;
}

function idsOf(items: readonly ActionItemRow[], type: ActionItemRow['sourceType']): string[] {
  return [...new Set(items.filter((item) => item.sourceType === type && item.sourceId).map((item) => item.sourceId as string))];
}

function sermonTitles(db: AppDatabase, ids: string[]): Map<string, string> {
  if (ids.length === 0) return new Map();
  const rows = db
    .select({ id: sermons.id, title: sermons.title })
    .from(sermons)
    .where(and(inArray(sermons.id, ids), isNull(sermons.deletedAt)))
    .all();
  return new Map(rows.map((row) => [row.id, row.title.trim() || 'Untitled sermon']));
}

/** Resolve sources for a list of action items with one query per source type. Missing sources are omitted. */
export function resolveActionSources(db: AppDatabase, items: readonly ActionItemRow[]): Map<string, ActionSource> {
  const recapIds = idsOf(items, 'sermon_recap');
  const recaps = recapIds.length
    ? db
        .select({ id: sermonRecaps.id, sermonId: sermonRecaps.sermonId })
        .from(sermonRecaps)
        .where(and(inArray(sermonRecaps.id, recapIds), isNull(sermonRecaps.deletedAt)))
        .all()
    : [];
  const recapSermon = new Map(recaps.map((row) => [row.id, row.sermonId]));
  const titles = sermonTitles(db, [...idsOf(items, 'sermon'), ...recaps.map((row) => row.sermonId)]);
  const journalIds = idsOf(items, 'journal_entry');
  const journal = journalIds.length
    ? db
        .select()
        .from(journalEntries)
        .where(and(inArray(journalEntries.id, journalIds), isNull(journalEntries.deletedAt)))
        .all()
    : [];
  const journalTitles = new Map(journal.map((row) => [row.id, journalEntryTitle(row)]));

  const result = new Map<string, ActionSource>();
  for (const item of items) {
    const source = resolveOne(item, { titles, recapSermon, journalTitles });
    if (source) result.set(item.id, source);
  }
  return result;
}

interface Lookups {
  titles: Map<string, string>;
  recapSermon: Map<string, string>;
  journalTitles: Map<string, string>;
}

function resolveOne(item: ActionItemRow, { titles, recapSermon, journalTitles }: Lookups): ActionSource | null {
  const id = item.sourceId;
  if (!id) return null;
  switch (item.sourceType) {
    case 'sermon': {
      const title = titles.get(id);
      return title ? { label: `From the sermon “${title}”`, href: `/sermons/${encodeURIComponent(id)}` as Href } : null;
    }
    case 'sermon_recap': {
      const sermonId = recapSermon.get(id);
      const title = sermonId ? titles.get(sermonId) : undefined;
      return sermonId && title
        ? { label: `From the recap of “${title}”`, href: `/sermons/${encodeURIComponent(sermonId)}/recap` as Href }
        : null;
    }
    case 'journal_entry': {
      const title = journalTitles.get(id);
      return title ? { label: `From your journal: ${title}`, href: `/journal/${encodeURIComponent(id)}` as Href } : null;
    }
    case 'verse': {
      const range = parseVerseSource(id);
      return range ? { label: `From ${describeVerseRange(range.start, range.end)}`, href: passageHref(range.start) } : null;
    }
    case 'manual':
      return null;
  }
}
