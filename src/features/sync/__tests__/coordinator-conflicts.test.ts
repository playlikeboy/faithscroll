import { eq, sql } from 'drizzle-orm';

import { enqueueChange } from '@/db/mutations';
import { journalEntries } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';

import { applyOtherVersion, entityLabel, keepLocalVersion, listOpenConflicts, previewOf } from '../conflicts';
import { classifySyncFailure, createSyncCoordinator, retryDelay, RETRY_BASE_MS } from '../coordinator';
import { recordConflict } from '../local-store';
import { SyncRemoteError } from '../remote';
import { createFakeSupabase } from '../testing/fake-supabase';

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  getErrorMessage: (error: unknown) => String(error),
}));

const USER = '33333333-3333-4333-8333-333333333333';

function addEntry(db: AppDatabase, id: string, content: string): void {
  db.transaction((tx) => {
    tx.insert(journalEntries).values({ id, title: 'T', content, entryDate: '2026-11-11' }).run();
    enqueueChange(tx, 'journal_entry', id);
  });
}

describe('sync coordinator', () => {
  afterEach(() => jest.useRealTimers());

  function setup(overrides: { enabled?: boolean; userId?: string | null } = {}) {
    const db = createTestDb();
    const { client, server } = createFakeSupabase(USER);
    const onStart = jest.fn();
    const onSuccess = jest.fn();
    const onFailure = jest.fn();
    const coordinator = createSyncCoordinator({
      db,
      getClient: () => client,
      getUserId: () => (overrides.userId === undefined ? USER : overrides.userId),
      isEnabled: () => overrides.enabled ?? true,
      onStart,
      onSuccess,
      onFailure,
    });
    return { db, server, coordinator, onStart, onSuccess, onFailure };
  }

  test('does nothing while disabled or signed out', async () => {
    for (const options of [{ enabled: false }, { userId: null }]) {
      const { db, server, coordinator, onStart } = setup(options);
      addEntry(db, 'aaaaaaaa-0000-4000-8000-000000000001', 'x');
      await coordinator.requestSync('manual');
      expect(onStart).not.toHaveBeenCalled();
      expect(server.requests).toHaveLength(0);
    }
  });

  test('runs one sync at a time and follows up once for requests made meanwhile', async () => {
    const { db, server, coordinator, onSuccess } = setup();
    addEntry(db, 'aaaaaaaa-0000-4000-8000-000000000002', 'x');

    const first = coordinator.requestSync('manual');
    const second = coordinator.requestSync('local-change');
    const third = coordinator.requestSync('interval');
    expect(coordinator.isRunning()).toBe(true);
    await Promise.all([first, second, third]);

    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(server.rows('journal_entries')).toHaveLength(1);
    expect(coordinator.isRunning()).toBe(false);
  });

  test('reports offline failures and retries with backoff', async () => {
    jest.useFakeTimers();
    const { db, server, coordinator, onFailure, onSuccess } = setup();
    addEntry(db, 'aaaaaaaa-0000-4000-8000-000000000003', 'x');
    server.failNext({ kind: 'network', op: 'select' });

    await coordinator.requestSync('manual');
    expect(onFailure).toHaveBeenCalledWith('offline');

    await jest.advanceTimersByTimeAsync(RETRY_BASE_MS);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(server.rows('journal_entries')).toHaveLength(1);
    coordinator.stop();
  });

  test('classifies failures and caps the backoff', () => {
    expect(classifySyncFailure(new SyncRemoteError('network', '0'))).toBe('offline');
    expect(classifySyncFailure(new SyncRemoteError('auth', '401'))).toBe('auth');
    expect(classifySyncFailure(new SyncRemoteError('server', '503'))).toBe('server');
    expect(classifySyncFailure(new Error('bug'))).toBe('unknown');
    expect(retryDelay(1)).toBe(RETRY_BASE_MS);
    expect(retryDelay(2)).toBe(RETRY_BASE_MS * 2);
    expect(retryDelay(50)).toBe(15 * 60 * 1000);
  });
});

describe('conflict review', () => {
  const ID = 'bbbbbbbb-0000-4000-8000-000000000001';

  function setupConflict() {
    const db = createTestDb();
    addEntry(db, ID, 'phone text');
    db.run(sql`DELETE FROM outbox`);
    db.run(sql`UPDATE journal_entries SET version = 4 WHERE id = ${ID}`);
    const local = db.get<Record<string, string | number | null>>(sql`SELECT * FROM journal_entries WHERE id = ${ID}`);
    recordConflict(db, 'journal_entry', ID, local, { ...local, content: 'ipad text', title: 'From iPad', version: 3 });
    return db;
  }

  test('lists open conflicts with readable previews', () => {
    const db = setupConflict();
    const [conflict] = listOpenConflicts(db);

    expect(conflict).toMatchObject({ entityType: 'journal_entry', entityId: ID });
    expect(previewOf(conflict.local)).toBe('T');
    expect(previewOf(conflict.remote)).toBe('From iPad');
    expect(previewOf({ deleted_at: '2026-11-11T00:00:00.000Z' })).toBe('Deleted');
    expect(previewOf({ content: 'x'.repeat(200) })).toHaveLength(90);
    expect(entityLabel('prayer_entry')).toBe('Prayer');
  });

  test('keeping this device only resolves the conflict', () => {
    const db = setupConflict();
    const [conflict] = listOpenConflicts(db);

    keepLocalVersion(db, conflict.id);

    expect(listOpenConflicts(db)).toHaveLength(0);
    expect(db.select().from(journalEntries).where(eq(journalEntries.id, ID)).get()?.content).toBe('phone text');
  });

  test('using the other version copies it as a new local edit that will sync', () => {
    const db = setupConflict();
    const [conflict] = listOpenConflicts(db);

    expect(applyOtherVersion(db, conflict)).toBe(true);

    const row = db.select().from(journalEntries).where(eq(journalEntries.id, ID)).get();
    expect(row).toMatchObject({ content: 'ipad text', title: 'From iPad', version: 5 });
    expect(db.all(sql`SELECT entity_type, entity_id FROM outbox`)).toEqual([{ entity_type: 'journal_entry', entity_id: ID }]);
    expect(listOpenConflicts(db)).toHaveLength(0);
  });

  test('dismisses a conflict whose row no longer exists', () => {
    const db = setupConflict();
    const [conflict] = listOpenConflicts(db);
    db.run(sql`DELETE FROM journal_entries WHERE id = ${ID}`);

    expect(applyOtherVersion(db, conflict)).toBe(false);
    expect(listOpenConflicts(db)).toHaveLength(0);
  });
});
