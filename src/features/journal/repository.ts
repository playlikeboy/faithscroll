/**
 * Journal entries: private, dated notebook entries (PRD §6.4).
 * All writes enqueue an outbox change in the same transaction; deletes are soft (tombstones).
 */
import { and, desc, eq, isNull, or } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { journalEntries } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { createLinkRow, removeAllLinksFor } from '@/features/links/repository';
import type { EntityRef } from '@/features/links/resolve';
import { attachScriptureReferenceRow, detachAllScriptureReferencesFor } from '@/features/links/scripture-references';
import { containsText, normalizeSearchTerm } from '@/features/links/text-search';
import { removeAllTagsFor } from '@/features/tags/repository';
import { newId } from '@/lib/ids';
import { toLocalDateString } from '@/lib/time';

import { parseLocalDate } from './dates';
import { DEFAULT_JOURNAL_TYPE, isJournalEntryType, type JournalEntry, type JournalEntryType } from './types';

export interface NewJournalEntry {
  title?: string;
  content?: string;
  entryType?: JournalEntryType;
  prompt?: string | null;
  /** YYYY-MM-DD; defaults to today (local). */
  entryDate?: string;
}

export type JournalEntryChanges = Partial<Pick<JournalEntry, 'title' | 'content' | 'entryType' | 'prompt' | 'entryDate'>>;

export interface PassageIds {
  startVerseId: number;
  endVerseId: number;
}

/** Things to attach when the entry is created (e.g. prefilled from a verse or a sermon). */
export interface JournalAttachments {
  passages?: readonly PassageIds[];
  links?: readonly EntityRef[];
}

export interface JournalListOptions {
  type?: JournalEntryType | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export const DEFAULT_JOURNAL_PAGE_SIZE = 50;

function assertValidChanges(changes: JournalEntryChanges): void {
  if (changes.entryType !== undefined && !isJournalEntryType(changes.entryType)) {
    throw new Error('Unknown journal entry type');
  }
  if (changes.entryDate !== undefined && !parseLocalDate(changes.entryDate)) {
    throw new Error('Entry date must be a calendar date (YYYY-MM-DD)');
  }
}

export function getJournalEntry(db: AppDatabase, id: string): JournalEntry | null {
  return (
    db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), isNull(journalEntries.deletedAt)))
      .get() ?? null
  );
}

export function createJournalEntry(
  db: AppDatabase,
  input: NewJournalEntry,
  attachments: JournalAttachments = {},
): JournalEntry {
  const values = {
    id: newId(),
    title: input.title ?? '',
    content: input.content ?? '',
    entryType: input.entryType ?? DEFAULT_JOURNAL_TYPE,
    prompt: input.prompt ?? null,
    entryDate: input.entryDate ?? toLocalDateString(),
  };
  assertValidChanges(values);

  return db.transaction((tx) => {
    tx.insert(journalEntries).values(values).run();
    enqueueChange(tx, 'journal_entry', values.id, 'upsert');
    for (const passage of attachments.passages ?? []) {
      attachScriptureReferenceRow(tx, { sourceType: 'journal_entry', sourceId: values.id, ...passage });
    }
    for (const target of attachments.links ?? []) {
      createLinkRow(tx, { type: 'journal_entry', id: values.id }, target);
    }
    const created = getJournalEntry(tx, values.id);
    if (!created) throw new Error('Could not create journal entry');
    return created;
  });
}

export function updateJournalEntry(db: AppDatabase, id: string, changes: JournalEntryChanges): void {
  assertValidChanges(changes);
  db.transaction((tx) => {
    const result = tx
      .update(journalEntries)
      .set({ ...changes, ...touch(journalEntries.version) })
      .where(and(eq(journalEntries.id, id), isNull(journalEntries.deletedAt)))
      .run();
    if (result.changes === 0) throw new Error('Journal entry not found');
    enqueueChange(tx, 'journal_entry', id, 'upsert');
  });
}

/** Query builder for the timeline (newest day first). Exposed for live queries. */
export function journalListQuery(db: AppDatabase, options: JournalListOptions = {}) {
  const search = normalizeSearchTerm(options.search);
  const conditions = [
    isNull(journalEntries.deletedAt),
    options.type ? eq(journalEntries.entryType, options.type) : undefined,
    search ? or(containsText(journalEntries.title, search), containsText(journalEntries.content, search)) : undefined,
  ];
  return db
    .select()
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
    .limit(options.limit ?? DEFAULT_JOURNAL_PAGE_SIZE)
    .offset(options.offset ?? 0);
}

export function listJournalEntries(db: AppDatabase, options: JournalListOptions = {}): JournalEntry[] {
  return journalListQuery(db, options).all();
}

/** Soft-delete an entry and clear its links, attached passages and tags. */
export function deleteJournalEntry(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    const result = tx
      .update(journalEntries)
      .set(tombstone(journalEntries.version))
      .where(and(eq(journalEntries.id, id), isNull(journalEntries.deletedAt)))
      .run();
    if (result.changes === 0) return;
    enqueueChange(tx, 'journal_entry', id, 'delete');
    removeAllLinksFor(tx, { type: 'journal_entry', id });
    detachAllScriptureReferencesFor(tx, 'journal_entry', id);
    removeAllTagsFor(tx, 'journal_entry', id);
  });
}
