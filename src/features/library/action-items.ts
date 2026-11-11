/** Action items ("Live it out"): repository for the Library › Action items screen. */
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { actionItems } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

export type ActionItemRow = typeof actionItems.$inferSelect;
export type ActionFilter = 'open' | 'completed';

export const MAX_ACTION_TITLE_LENGTH = 200;
export const ACTION_TABLES = ['action_items'] as const;

const isoDate = z.iso.datetime({ offset: true });

const actionInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give this action a short title.')
    .max(MAX_ACTION_TITLE_LENGTH, `Keep the title under ${MAX_ACTION_TITLE_LENGTH} characters.`),
  notes: z.string().trim().max(5000, 'Notes are too long.').nullish(),
  dueAt: isoDate.nullish(),
});

export type ActionInput = z.input<typeof actionInputSchema>;

function parseInput(input: ActionInput): { title: string; notes: string | null; dueAt: string | null } {
  const result = actionInputSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Please check this action.');
  return { title: result.data.title, notes: result.data.notes || null, dueAt: result.data.dueAt ?? null };
}

export function listActionItems(db: AppDatabase, filter: ActionFilter): ActionItemRow[] {
  if (filter === 'completed') {
    return db
      .select()
      .from(actionItems)
      .where(and(isNull(actionItems.deletedAt), isNotNull(actionItems.completedAt)))
      .orderBy(desc(actionItems.completedAt))
      .all();
  }
  return db
    .select()
    .from(actionItems)
    .where(and(isNull(actionItems.deletedAt), isNull(actionItems.completedAt)))
    .orderBy(asc(sql`${actionItems.dueAt} is null`), asc(actionItems.dueAt), desc(actionItems.createdAt))
    .all();
}

export function getActionItem(db: AppDatabase, id: string): ActionItemRow | undefined {
  return db.select().from(actionItems).where(and(eq(actionItems.id, id), isNull(actionItems.deletedAt))).get();
}

/** A manual action the user adds themselves. */
export function createActionItem(db: AppDatabase, input: ActionInput): string {
  const values = parseInput(input);
  const id = newId();
  db.transaction((tx) => {
    tx.insert(actionItems).values({ id, ...values, sourceType: 'manual' }).run();
    enqueueChange(tx, 'action_item', id);
  });
  return id;
}

function update(db: AppDatabase, id: string, changes: Partial<ActionItemRow>): void {
  db.transaction((tx) => {
    if (!getActionItem(tx, id)) throw new Error('This action no longer exists.');
    tx.update(actionItems)
      .set({ ...changes, ...touch(actionItems.version) })
      .where(eq(actionItems.id, id))
      .run();
    enqueueChange(tx, 'action_item', id);
  });
}

export function updateActionItem(db: AppDatabase, id: string, input: ActionInput): void {
  update(db, id, parseInput(input));
}

export function setActionItemCompleted(db: AppDatabase, id: string, completed: boolean): void {
  update(db, id, { completedAt: completed ? nowIso() : null });
}

export function setActionItemReminder(db: AppDatabase, id: string, reminderAt: string | null, reminderNotificationId: string | null): void {
  update(db, id, { reminderAt, reminderNotificationId });
}

export function deleteActionItem(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    if (!getActionItem(tx, id)) return;
    tx.update(actionItems).set(tombstone(actionItems.version)).where(eq(actionItems.id, id)).run();
    enqueueChange(tx, 'action_item', id, 'delete');
  });
}
