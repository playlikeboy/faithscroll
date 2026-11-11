/**
 * Journal timeline: entries enriched with tags, attached passages and link counts,
 * grouped into day sections for a SectionList.
 */
import type { AppDatabase } from '@/db/types';
import { countLinksFor } from '@/features/links/repository';
import { listScriptureReferencesForSources, type ScriptureReference } from '@/features/links/scripture-references';
import { listTagsForEntities, type Tag } from '@/features/tags/repository';

import { formatDayHeading } from './dates';
import { excerpt } from './plain-text';
import { listJournalEntries, type JournalListOptions } from './repository';
import type { JournalEntry } from './types';

export interface JournalTimelineItem {
  entry: JournalEntry;
  /** Entry title, or null when the user hasn't given one. */
  title: string | null;
  excerpt: string;
  tags: Tag[];
  references: ScriptureReference[];
  linkCount: number;
}

export interface JournalSection {
  /** YYYY-MM-DD */
  key: string;
  title: string;
  data: JournalTimelineItem[];
}

/** Tables the timeline reads; reload when any of them change. */
export const JOURNAL_TIMELINE_TABLES = [
  'journal_entries',
  'entity_tags',
  'tags',
  'scripture_references',
  'entity_links',
] as const;

const TIMELINE_EXCERPT_LENGTH = 160;

export function loadJournalTimeline(db: AppDatabase, options: JournalListOptions = {}): JournalTimelineItem[] {
  const entries = listJournalEntries(db, options);
  const ids = entries.map((entry) => entry.id);
  const tags = listTagsForEntities(db, 'journal_entry', ids);
  const references = listScriptureReferencesForSources(db, 'journal_entry', ids);
  const linkCounts = countLinksFor(db, 'journal_entry', ids);

  return entries.map((entry) => ({
    entry,
    title: entry.title.trim() || null,
    excerpt: excerpt(entry.content, TIMELINE_EXCERPT_LENGTH),
    tags: tags.get(entry.id) ?? [],
    references: references.get(entry.id) ?? [],
    linkCount: linkCounts.get(entry.id) ?? 0,
  }));
}

/** Group (already date-sorted) items into consecutive day sections. */
export function groupTimelineByDay(items: readonly JournalTimelineItem[], today: Date = new Date()): JournalSection[] {
  const sections: JournalSection[] = [];
  for (const item of items) {
    const key = item.entry.entryDate;
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      sections[sections.length - 1] = { ...last, data: [...last.data, item] };
    } else {
      sections.push({ key, title: formatDayHeading(key, today), data: [item] });
    }
  }
  return sections;
}
