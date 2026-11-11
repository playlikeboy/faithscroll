/**
 * Prayer journal (PRD §6.5). Status changes are recorded as `prayer_updates` so the
 * story of a prayer is kept; nothing is ever framed as failure.
 */
import { and, desc, eq, isNull, or } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { prayerEntries, prayerUpdates } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { PassageIds } from '@/features/journal/repository';
import { removeAllLinksFor } from '@/features/links/repository';
import { attachScriptureReferenceRow, detachAllScriptureReferencesFor } from '@/features/links/scripture-references';
import { containsText, normalizeSearchTerm } from '@/features/links/text-search';
import { removeAllTagsFor } from '@/features/tags/repository';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import { isPrayerStatus, type Prayer, type PrayerStatus, type PrayerUpdate } from './types';

export interface NewPrayer {
  title: string;
  content?: string;
  category?: string | null;
}

export type PrayerChanges = Partial<Pick<Prayer, 'title' | 'content' | 'category'>>;

export interface PrayerListOptions {
  status?: PrayerStatus | null;
  search?: string | null;
}

export interface PrayerReminderFields {
  reminderAt: string;
  notificationId: string | null;
}

function cleanCategory(category: string | null | undefined): string | null | undefined {
  if (category === undefined) return undefined;
  const trimmed = category?.trim() ?? '';
  return trimmed || null;
}

function cleanChanges(changes: PrayerChanges): PrayerChanges {
  return {
    ...changes,
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(changes.category !== undefined ? { category: cleanCategory(changes.category) } : {}),
  };
}

const live = (id: string) => and(eq(prayerEntries.id, id), isNull(prayerEntries.deletedAt));

export function getPrayer(db: AppDatabase, id: string): Prayer | null {
  return db.select().from(prayerEntries).where(live(id)).get() ?? null;
}

function requirePrayer(db: AppDatabase, id: string): Prayer {
  const prayer = getPrayer(db, id);
  if (!prayer) throw new Error('Prayer not found');
  return prayer;
}

export function createPrayer(db: AppDatabase, input: NewPrayer, attachments: { passages?: readonly PassageIds[] } = {}): Prayer {
  const id = newId();
  return db.transaction((tx) => {
    tx.insert(prayerEntries)
      .values({ id, title: input.title.trim(), content: input.content ?? '', category: cleanCategory(input.category) ?? null })
      .run();
    enqueueChange(tx, 'prayer_entry', id, 'upsert');
    for (const passage of attachments.passages ?? []) {
      attachScriptureReferenceRow(tx, { sourceType: 'prayer_entry', sourceId: id, ...passage });
    }
    return requirePrayer(tx, id);
  });
}

function updatePrayerRow(db: AppDatabase, id: string, changes: Partial<Prayer>): void {
  const result = db
    .update(prayerEntries)
    .set({ ...changes, ...touch(prayerEntries.version) })
    .where(live(id))
    .run();
  if (result.changes === 0) throw new Error('Prayer not found');
  enqueueChange(db, 'prayer_entry', id, 'upsert');
}

export function updatePrayer(db: AppDatabase, id: string, changes: PrayerChanges): void {
  db.transaction((tx) => updatePrayerRow(tx, id, cleanChanges(changes)));
}

function insertUpdate(db: AppDatabase, prayerId: string, content: string, statusChange: PrayerStatus | null): PrayerUpdate {
  const id = newId();
  db.insert(prayerUpdates).values({ id, prayerId, content, statusChange }).run();
  enqueueChange(db, 'prayer_update', id, 'upsert');
  const row = db.select().from(prayerUpdates).where(eq(prayerUpdates.id, id)).get();
  if (!row) throw new Error('Could not save prayer update');
  return row;
}

/**
 * Move a prayer to a new status, recording an update (with an optional note).
 * Same status + note → a plain note; same status without a note → no-op (returns null).
 */
export function changePrayerStatus(db: AppDatabase, id: string, status: PrayerStatus, note?: string | null): PrayerUpdate | null {
  if (!isPrayerStatus(status)) throw new Error('Unknown prayer status');
  const text = note?.trim() ?? '';
  return db.transaction((tx) => {
    const prayer = requirePrayer(tx, id);
    if (prayer.status === status) {
      if (!text) return null;
      updatePrayerRow(tx, id, {});
      return insertUpdate(tx, id, text, null);
    }
    updatePrayerRow(tx, id, { status, answeredAt: status === 'answered' ? nowIso() : null });
    return insertUpdate(tx, id, text, status);
  });
}

/** Add a note to a prayer's story without changing its status. */
export function addPrayerUpdate(db: AppDatabase, prayerId: string, content: string): PrayerUpdate {
  const text = content.trim();
  if (!text) throw new Error('An update needs some text');
  return db.transaction((tx) => {
    updatePrayerRow(tx, prayerId, {});
    return insertUpdate(tx, prayerId, text, null);
  });
}

export function listPrayerUpdates(db: AppDatabase, prayerId: string): PrayerUpdate[] {
  return db
    .select()
    .from(prayerUpdates)
    .where(and(eq(prayerUpdates.prayerId, prayerId), isNull(prayerUpdates.deletedAt)))
    .orderBy(desc(prayerUpdates.createdAt))
    .all();
}

export function listPrayers(db: AppDatabase, options: PrayerListOptions = {}): Prayer[] {
  const search = normalizeSearchTerm(options.search);
  return db
    .select()
    .from(prayerEntries)
    .where(
      and(
        isNull(prayerEntries.deletedAt),
        options.status ? eq(prayerEntries.status, options.status) : undefined,
        search ? or(containsText(prayerEntries.title, search), containsText(prayerEntries.content, search)) : undefined,
      ),
    )
    .orderBy(desc(prayerEntries.updatedAt))
    .all();
}

/** Store (or clear with null) the reminder time and its scheduled notification id. */
export function setPrayerReminderFields(db: AppDatabase, id: string, reminder: PrayerReminderFields | null): void {
  db.transaction((tx) =>
    updatePrayerRow(tx, id, {
      reminderAt: reminder?.reminderAt ?? null,
      reminderNotificationId: reminder?.notificationId ?? null,
    }),
  );
}

/**
 * Soft-delete a prayer with its updates, links, passages and tags.
 * Returns the deleted row (so a scheduled reminder can be cancelled) or null if it didn't exist.
 */
export function deletePrayer(db: AppDatabase, id: string): Prayer | null {
  return db.transaction((tx) => {
    const prayer = getPrayer(tx, id);
    if (!prayer) return null;
    tx.update(prayerEntries).set(tombstone(prayerEntries.version)).where(eq(prayerEntries.id, id)).run();
    enqueueChange(tx, 'prayer_entry', id, 'delete');
    const updates = tx
      .select({ id: prayerUpdates.id })
      .from(prayerUpdates)
      .where(and(eq(prayerUpdates.prayerId, id), isNull(prayerUpdates.deletedAt)))
      .all();
    for (const update of updates) {
      tx.update(prayerUpdates).set(tombstone(prayerUpdates.version)).where(eq(prayerUpdates.id, update.id)).run();
      enqueueChange(tx, 'prayer_update', update.id, 'delete');
    }
    removeAllLinksFor(tx, { type: 'prayer_entry', id });
    detachAllScriptureReferencesFor(tx, 'prayer_entry', id);
    removeAllTagsFor(tx, 'prayer_entry', id);
    return prayer;
  });
}
