/**
 * "Also erase data on this device" (used after account deletion): removes every row from the
 * local user database, cancels scheduled reminders and deletes local sermon recordings.
 * Display preferences (theme, text size) are kept.
 */
import { getTableName, is, sql } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { Directory, Paths } from 'expo-file-system';

import * as schema from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { cancelReminder } from '@/features/reminders/notifications';
import { logger } from '@/lib/logger';

/** Folder (inside the document directory) where the sermons feature keeps recordings. */
export const RECORDINGS_FOLDER = 'recordings';

/** Every table declared in the shared local schema. */
export function listLocalTables(): string[] {
  const tables: string[] = [];
  for (const value of Object.values(schema) as unknown[]) {
    if (is(value, SQLiteTable)) tables.push(getTableName(value));
  }
  return tables;
}

const REMINDER_TABLES = ['prayer_entries', 'action_items', 'plan_progress'] as const;

export function listScheduledReminderIdsInDb(db: AppDatabase): string[] {
  const ids: string[] = [];
  for (const table of REMINDER_TABLES) {
    const rows = db.all<{ id: string | null }>(
      sql`SELECT reminder_notification_id AS id FROM ${sql.identifier(table)} WHERE reminder_notification_id IS NOT NULL`,
    );
    for (const row of rows) if (row.id) ids.push(row.id);
  }
  return ids;
}

/** Delete all rows in one transaction; foreign keys are checked at commit, so order doesn't matter. */
export function eraseLocalDatabase(db: AppDatabase): void {
  const tables = listLocalTables();
  db.transaction((tx) => {
    tx.run(sql`PRAGMA defer_foreign_keys = ON`);
    for (const table of tables) tx.run(sql`DELETE FROM ${sql.identifier(table)}`);
  });
}

function deleteRecordingFiles(): void {
  try {
    const folder = new Directory(Paths.document, RECORDINGS_FOLDER);
    if (folder.exists) folder.delete();
  } catch (error) {
    logger.error('Could not delete local recordings', error);
  }
}

export async function eraseLocalUserData(db: AppDatabase): Promise<void> {
  const reminderIds = listScheduledReminderIdsInDb(db);
  await Promise.all(
    reminderIds.map((id) =>
      cancelReminder(id).catch((error: unknown) => logger.warn('Could not cancel a reminder', { error: String(error) })),
    ),
  );
  eraseLocalDatabase(db);
  deleteRecordingFiles();
}
