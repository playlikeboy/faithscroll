import { Directory } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';

import * as schema from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import { signOut } from '@/features/auth/account-actions';
import { deleteAllLocalData, wipeUserTables } from '@/features/export/wipe-local-data';
import { cancelReminder, listScheduledReminderIds } from '@/features/reminders/notifications';
import { useAnalyticsConsent } from '@/services/monitoring/analytics-consent';
import { usePreferences } from '@/stores/preferences';

const mockDeleted: string[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///doc', cache: 'file:///cache' },
  File: jest.fn(),
  Directory: jest.fn().mockImplementation((base: string, name: string) => ({
    exists: name !== 'Audio',
    delete: () => mockDeleted.push(`${base}/${name}`),
    create: jest.fn(),
  })),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/features/auth/account-actions', () => ({ signOut: jest.fn(async () => ({ status: 'success' })) }));
jest.mock('@/features/recording/recording-files', () => ({ RECORDINGS_FOLDER: 'recordings' }));
jest.mock('@/features/reminders/notifications', () => ({
  listScheduledReminderIds: jest.fn(async () => ['n1', 'n2']),
  cancelReminder: jest.fn(async () => undefined),
}));

function seedEverything(db: AppDatabase) {
  db.insert(schema.journalEntries).values({ id: 'j1', content: 'private', entryDate: '2026-11-11' }).run();
  db.insert(schema.sermons).values({ id: 's1', title: 'Sermon' }).run();
  db.insert(schema.sermonNotes).values({ id: 'n1', sermonId: 's1', content: 'notes' }).run();
  db.insert(schema.transcripts).values({ id: 't1', sermonId: 's1' }).run();
  db.insert(schema.transcriptSegments).values({ id: 'ts1', transcriptId: 't1', startMs: 0, endMs: 1, text: 'x', sortOrder: 0 }).run();
  db.insert(schema.prayerEntries).values({ id: 'p1', title: 'Prayer' }).run();
  db.insert(schema.tags).values({ id: 'tag1', name: 'hope' }).run();
  db.insert(schema.entityTags).values({ entityType: 'journal_entry', entityId: 'j1', tagId: 'tag1' }).run();
  db.insert(schema.outbox).values({ entityType: 'journal_entry', entityId: 'j1', operation: 'upsert' }).run();
  db.insert(schema.syncState).values({ key: 'cursor', value: 'x' }).run();
  db.insert(schema.readingProgress).values({ translationId: 'WEB', bookId: 1, chapter: 1 }).run();
}

const TABLES = [
  schema.journalEntries,
  schema.sermons,
  schema.sermonNotes,
  schema.transcripts,
  schema.transcriptSegments,
  schema.prayerEntries,
  schema.tags,
  schema.entityTags,
  schema.outbox,
  schema.syncState,
  schema.readingProgress,
];

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleted.length = 0;
});

test('wipeUserTables hard-deletes every personal row without queueing sync deletes', () => {
  const db = createTestDb();
  seedEverything(db);

  wipeUserTables(db);

  for (const table of TABLES) expect(db.select().from(table).all()).toHaveLength(0);
});

describe('deleteAllLocalData', () => {
  test('cancels reminders, signs out, wipes data, files and settings', async () => {
    const db = createTestDb();
    seedEverything(db);
    usePreferences.setState({ onboardingCompleted: true, readingGoal: 'daily_chapter' });
    const clear = jest.spyOn(Storage, 'clear');

    const result = await deleteAllLocalData(db);

    expect(result.failedSteps).toEqual([]);
    expect(jest.mocked(listScheduledReminderIds)).toHaveBeenCalled();
    expect(jest.mocked(cancelReminder).mock.calls.map(([id]) => id)).toEqual(['n1', 'n2']);
    expect(jest.mocked(signOut)).toHaveBeenCalled();
    expect(db.select().from(schema.journalEntries).all()).toHaveLength(0);
    expect(mockDeleted).toEqual(['file:///doc/recordings', 'file:///doc/ExpoAudio', 'file:///cache/exports']);
    expect(jest.mocked(Directory)).toHaveBeenCalledWith('file:///doc', 'Audio');
    expect(clear).toHaveBeenCalled();
    expect(usePreferences.getState()).toMatchObject({ onboardingCompleted: false, readingGoal: null });
  });

  test('keeps the analytics opt-out but forgets the install id', async () => {
    useAnalyticsConsent.setState({ enabled: false, installId: 'old-id' });

    await deleteAllLocalData(createTestDb());

    expect(useAnalyticsConsent.getState()).toMatchObject({ enabled: false, installId: null });
  });

  test('reports failed steps and still runs the rest', async () => {
    jest.mocked(signOut).mockResolvedValueOnce({ status: 'error', message: 'offline' });
    const db = createTestDb();
    seedEverything(db);

    const result = await deleteAllLocalData(db);

    expect(result.failedSteps).toEqual(['sign_out']);
    expect(db.select().from(schema.journalEntries).all()).toHaveLength(0);
  });
});
