import { sql } from 'drizzle-orm';

import { enqueueChange } from '@/db/mutations';
import { journalEntries, prayerEntries, sermonNotes, sermons, syncState, tags } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';

import { eraseLocalUserData, listLocalTables, listScheduledReminderIdsInDb } from '../erase-local-data';

const mockCancelReminder = jest.fn(async (_id: string) => undefined);
jest.mock('@/features/reminders/notifications', () => ({
  cancelReminder: (id: string) => mockCancelReminder(id),
}));

const mockDirectory = { exists: true, delete: jest.fn() };
jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///documents/' } },
  Directory: jest.fn(() => mockDirectory),
}));

function seed() {
  const db = createTestDb();
  db.insert(journalEntries).values({ id: 'j1', title: 'Morning', content: 'Thankful', entryDate: '2026-11-11' }).run();
  db.insert(prayerEntries).values({ id: 'p1', title: 'For family', reminderNotificationId: 'notif-1' }).run();
  db.insert(sermons).values({ id: 's1', title: 'Grace' }).run();
  db.insert(sermonNotes).values({ id: 'n1', sermonId: 's1', content: 'Point one' }).run();
  db.insert(tags).values({ id: 't1', name: 'Hope' }).run();
  db.insert(syncState).values({ key: 'pull:journal_entries', value: 'cursor' }).run();
  enqueueChange(db, 'journal_entry', 'j1');
  return db;
}

function count(db: ReturnType<typeof createTestDb>, table: string): number {
  return db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM ${sql.identifier(table)}`).n;
}

test('lists every table of the shared schema', () => {
  const tables = listLocalTables();
  expect(tables).toEqual(expect.arrayContaining(['journal_entries', 'outbox', 'sync_state', 'entity_tags', 'reading_history']));
  expect(tables).toHaveLength(28);
});

test('finds scheduled reminder ids', () => {
  expect(listScheduledReminderIdsInDb(seed())).toEqual(['notif-1']);
});

test('erases every row, cancels reminders and deletes recordings', async () => {
  const db = seed();

  await eraseLocalUserData(db);

  for (const table of listLocalTables()) expect(count(db, table)).toBe(0);
  expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
  expect(mockDirectory.delete).toHaveBeenCalled();
});

test('still erases the database when a reminder cannot be cancelled', async () => {
  const db = seed();
  mockCancelReminder.mockRejectedValueOnce(new Error('not scheduled'));

  await eraseLocalUserData(db);

  expect(count(db, 'prayer_entries')).toBe(0);
});
