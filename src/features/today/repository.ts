/**
 * Today tab data access. Query builders are returned un-executed so they work both with
 * `useLiveQuery` in the app and with `.all()` / `.get()` against the test database.
 */
import { and, desc, inArray, isNull } from 'drizzle-orm';

import { enqueueChange } from '@/db/mutations';
import {
  actionItems,
  journalEntries,
  prayerEntries,
  readingHistory,
  readingProgress,
  scriptureReferences,
  sermons,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { VerseRange } from '@/features/bible/types';
import { rangeToIds } from '@/features/bible/verse-id';
import { newId } from '@/lib/ids';
import { toLocalDateString } from '@/lib/time';

/** Where the reader last was (any translation), most recent first. */
export function latestReadingProgressQuery(db: AppDatabase) {
  return db.select().from(readingProgress).orderBy(desc(readingProgress.updatedAt)).limit(1);
}

export function lastChapterReadQuery(db: AppDatabase) {
  return db.select().from(readingHistory).orderBy(desc(readingHistory.readAt)).limit(1);
}

export function latestSermonQuery(db: AppDatabase) {
  return db
    .select({ id: sermons.id, title: sermons.title, speaker: sermons.speaker, updatedAt: sermons.updatedAt })
    .from(sermons)
    .where(isNull(sermons.deletedAt))
    .orderBy(desc(sermons.updatedAt))
    .limit(1);
}

export function latestJournalEntryQuery(db: AppDatabase) {
  return db
    .select({
      id: journalEntries.id,
      title: journalEntries.title,
      prompt: journalEntries.prompt,
      content: journalEntries.content,
      entryDate: journalEntries.entryDate,
      updatedAt: journalEntries.updatedAt,
    })
    .from(journalEntries)
    .where(isNull(journalEntries.deletedAt))
    .orderBy(desc(journalEntries.updatedAt))
    .limit(1);
}

/** A prayer the user is still holding (praying / ongoing). */
export function pendingPrayerQuery(db: AppDatabase) {
  return db
    .select({ id: prayerEntries.id, title: prayerEntries.title, updatedAt: prayerEntries.updatedAt })
    .from(prayerEntries)
    .where(and(isNull(prayerEntries.deletedAt), inArray(prayerEntries.status, ['praying', 'ongoing'])))
    .orderBy(desc(prayerEntries.updatedAt))
    .limit(1);
}

export function openActionItemQuery(db: AppDatabase) {
  return db
    .select({ id: actionItems.id, title: actionItems.title, createdAt: actionItems.createdAt })
    .from(actionItems)
    .where(and(isNull(actionItems.deletedAt), isNull(actionItems.completedAt)))
    .orderBy(desc(actionItems.createdAt))
    .limit(1);
}

export interface NewReflection {
  prompt: string;
  content: string;
  /** Optional passage attached to the reflection. */
  passage?: { range: VerseRange; label: string } | null;
  date?: Date;
}

export const MAX_REFLECTION_LENGTH = 5_000;

/**
 * Creates a `reflection` journal entry (and a user scripture reference when a passage is attached)
 * in one transaction. Returns the new entry id.
 */
export function saveReflection(db: AppDatabase, input: NewReflection): string {
  const content = input.content.trim();
  if (!content) throw new Error('Reflection is empty');
  if (content.length > MAX_REFLECTION_LENGTH) throw new Error('Reflection is too long');

  const entryId = newId();
  db.transaction((tx) => {
    tx.insert(journalEntries)
      .values({
        id: entryId,
        content,
        entryType: 'reflection',
        prompt: input.prompt,
        entryDate: toLocalDateString(input.date ?? new Date()),
      })
      .run();
    enqueueChange(tx, 'journal_entry', entryId, 'upsert');

    if (input.passage) {
      const referenceId = newId();
      tx.insert(scriptureReferences)
        .values({
          id: referenceId,
          sourceType: 'journal_entry',
          sourceId: entryId,
          ...rangeToIds(input.passage.range),
          referenceText: input.passage.label,
          origin: 'user',
        })
        .run();
      enqueueChange(tx, 'scripture_reference', referenceId, 'upsert');
    }
  });
  return entryId;
}
