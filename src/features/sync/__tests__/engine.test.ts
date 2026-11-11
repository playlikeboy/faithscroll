import { eq, sql } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { journalEntries, prayerEntries, sermonNotes, sermons, syncConflicts } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';

import { prepareLocalDataForNextAccount, runSync } from '../engine';
import { countOpenConflicts, getBaseVersion, getState, stateKeys } from '../local-store';
import { PULL_PAGE_SIZE } from '../pull';
import { createSupabaseRemote } from '../remote';
import { createFakeSupabase, type FakeSupabaseServer } from '../testing/fake-supabase';

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  getErrorMessage: (error: unknown) => String(error),
}));

const USER = '11111111-1111-4111-8111-111111111111';

let idCounter = 0;
const uuid = () => `aaaaaaaa-0000-4000-8000-${String(++idCounter).padStart(12, '0')}`;

function setup() {
  const { client, server } = createFakeSupabase(USER);
  const remote = createSupabaseRemote(client, USER);
  const deviceA = createTestDb();
  const deviceB = createTestDb();
  const sync = (db: AppDatabase, now?: () => Date) => runSync({ db, remote, userId: USER, now });
  return { server, deviceA, deviceB, sync };
}

function addEntry(db: AppDatabase, content: string, id = uuid()): string {
  db.transaction((tx) => {
    tx.insert(journalEntries).values({ id, title: 'Reflection', content, entryDate: '2026-11-11' }).run();
    enqueueChange(tx, 'journal_entry', id);
  });
  return id;
}

function editEntry(db: AppDatabase, id: string, content: string): void {
  db.transaction((tx) => {
    tx.update(journalEntries).set({ content, ...touch(journalEntries.version) }).where(eq(journalEntries.id, id)).run();
    enqueueChange(tx, 'journal_entry', id);
  });
}

function deleteEntry(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    tx.update(journalEntries).set(tombstone(journalEntries.version)).where(eq(journalEntries.id, id)).run();
    enqueueChange(tx, 'journal_entry', id, 'delete');
  });
}

function entry(db: AppDatabase, id: string) {
  return db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();
}

function outboxCount(db: AppDatabase): number {
  return db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM outbox`).n;
}

function requests(server: FakeSupabaseServer, table: string, op: string): number {
  return server.requests.filter((r) => r.table === table && r.op === op).length;
}

describe('push', () => {
  test('uploads new rows in batches and clears the outbox', async () => {
    const { server, deviceA, sync } = setup();
    const ids = Array.from({ length: 250 }, (_, i) => addEntry(deviceA, `entry ${i}`));

    const stats = await sync(deviceA);

    expect(stats.pushed).toBe(250);
    expect(server.rows('journal_entries')).toHaveLength(250);
    expect(requests(server, 'journal_entries', 'upsert')).toBe(3);
    expect(outboxCount(deviceA)).toBe(0);
    expect(server.get('journal_entries', ids[0])).toMatchObject({ user_id: USER, content: 'entry 0', version: 1 });
    expect(getBaseVersion(deviceA, 'journal_entry', ids[0])).toBe(1);
  });

  test('coalesces several edits of one row into a single upsert of its latest state', async () => {
    const { server, deviceA, sync } = setup();
    const id = addEntry(deviceA, 'one');
    editEntry(deviceA, id, 'two');
    editEntry(deviceA, id, 'three');

    await sync(deviceA);

    expect(requests(server, 'journal_entries', 'upsert')).toBe(1);
    expect(server.get('journal_entries', id)).toMatchObject({ content: 'three', version: 3 });
    expect(outboxCount(deviceA)).toBe(0);
  });

  test('never pushes device-only columns', async () => {
    const { server, deviceA, sync } = setup();
    const id = uuid();
    deviceA.transaction((tx) => {
      tx.insert(prayerEntries).values({ id, title: 'For my sister', reminderNotificationId: 'local-notif' }).run();
      enqueueChange(tx, 'prayer_entry', id);
    });

    await sync(deviceA);

    expect(server.get('prayer_entries', id)).not.toHaveProperty('reminder_notification_id');
  });

  test('a network failure aborts without touching the outbox', async () => {
    const { server, deviceA, sync } = setup();
    addEntry(deviceA, 'offline');
    server.failNext({ kind: 'network', op: 'upsert', times: Infinity });

    await expect(sync(deviceA)).rejects.toMatchObject({ kind: 'network' });

    const row = deviceA.get<{ attempts: number; last_error: string | null }>(sql`SELECT attempts, last_error FROM outbox`);
    expect(row).toEqual({ attempts: 0, last_error: null });
  });

  test('isolates a row the server rejects, backs it off, and retries it later', async () => {
    const { server, deviceA, sync } = setup();
    const good = addEntry(deviceA, 'good');
    const bad = addEntry(deviceA, 'bad');
    server.failNext({ kind: 'rejected', op: 'upsert', rowMatches: (row) => row.id === bad, times: 2 });
    let clock = new Date('2026-11-11T12:00:00.000Z');
    const now = () => clock;

    const first = await sync(deviceA, now);

    expect(first.pushed).toBe(1);
    expect(first.failed).toBe(1);
    expect(server.get('journal_entries', good)).toBeDefined();
    expect(server.get('journal_entries', bad)).toBeUndefined();
    const failed = deviceA.get<{ attempts: number; last_error: string }>(
      sql`SELECT attempts, last_error FROM outbox WHERE entity_id = ${bad}`,
    );
    expect(failed).toEqual({ attempts: 1, last_error: '22P02' });
    expect(getState(deviceA, stateKeys.retry('journal_entry', bad))).toBe('2026-11-11T12:00:30.000Z');

    // Not due yet: no upload attempt.
    const before = requests(server, 'journal_entries', 'upsert');
    await sync(deviceA, now);
    expect(requests(server, 'journal_entries', 'upsert')).toBe(before);

    clock = new Date('2026-11-11T12:05:00.000Z');
    const later = await sync(deviceA, now);
    expect(later.pushed).toBe(1);
    expect(server.get('journal_entries', bad)).toMatchObject({ content: 'bad' });
    expect(outboxCount(deviceA)).toBe(0);
    expect(getState(deviceA, stateKeys.retry('journal_entry', bad))).toBeNull();
  });
});

describe('pull', () => {
  test('applies rows from another device with device timestamps', async () => {
    const { deviceA, deviceB, sync } = setup();
    const id = addEntry(deviceA, 'written on the phone');
    await sync(deviceA);

    const stats = await sync(deviceB);

    expect(stats.pulled).toBe(1);
    const pulled = entry(deviceB, id);
    expect(pulled).toMatchObject({ content: 'written on the phone', version: 1 });
    expect(pulled?.createdAt).toBe(entry(deviceA, id)?.createdAt);
    expect(pulled?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(outboxCount(deviceB)).toBe(0);
  });

  test('pages through large tables and stores the cursor', async () => {
    const { server, deviceB, sync } = setup();
    const total = PULL_PAGE_SIZE * 2 + 50;
    for (let i = 0; i < total; i += 1) {
      server.seed('journal_entries', { id: uuid(), title: '', content: `c${i}`, entry_type: 'personal', entry_date: '2026-11-10', version: 1 });
    }

    await sync(deviceB);

    expect(deviceB.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM journal_entries`).n).toBe(total);
    expect(requests(server, 'journal_entries', 'select')).toBe(3);
    expect(getState(deviceB, stateKeys.cursor('journal_entries'))).toMatch(/\+00:00$/);
  });

  test('keeps device-only columns when a row is updated remotely', async () => {
    const { server, deviceA, sync } = setup();
    const id = uuid();
    deviceA.transaction((tx) => {
      tx.insert(prayerEntries).values({ id, title: 'Healing', reminderNotificationId: 'notif-7' }).run();
      enqueueChange(tx, 'prayer_entry', id);
    });
    await sync(deviceA);
    server.seed('prayer_entries', { ...server.get('prayer_entries', id), status: 'answered', version: 2 });

    await sync(deviceA);

    const row = deviceA.select().from(prayerEntries).where(eq(prayerEntries.id, id)).get();
    expect(row).toMatchObject({ status: 'answered', version: 2, reminderNotificationId: 'notif-7' });
  });

  test('parks a child whose parent has not arrived and applies it once the parent does', async () => {
    const { server, deviceB, sync } = setup();
    const sermonId = uuid();
    const noteId = uuid();
    server.seed('sermon_notes', { id: noteId, sermon_id: sermonId, content: 'Point one', sort_order: 0, version: 1 });

    const first = await sync(deviceB);
    expect(first.deferred).toBe(1);
    expect(deviceB.select().from(sermonNotes).all()).toHaveLength(0);

    server.seed('sermons', { id: sermonId, title: 'Grace', version: 1 });
    const second = await sync(deviceB);

    expect(second.deferred).toBe(0);
    expect(deviceB.select().from(sermons).all()).toHaveLength(1);
    expect(deviceB.select().from(sermonNotes).where(eq(sermonNotes.id, noteId)).get()).toMatchObject({ content: 'Point one' });
  });
});

describe('tombstones', () => {
  test('a soft delete travels to the server and to other devices', async () => {
    const { server, deviceA, deviceB, sync } = setup();
    const id = addEntry(deviceA, 'to remove');
    await sync(deviceA);
    await sync(deviceB);

    deleteEntry(deviceA, id);
    await sync(deviceA);
    await sync(deviceB);

    expect(server.get('journal_entries', id)?.deleted_at).not.toBeNull();
    expect(entry(deviceB, id)?.deletedAt).not.toBeNull();
  });

  test('a row hard-deleted on the device is tombstoned on the server', async () => {
    const { server, deviceA, sync } = setup();
    const id = addEntry(deviceA, 'gone');
    await sync(deviceA);
    deviceA.transaction((tx) => {
      tx.delete(journalEntries).where(eq(journalEntries.id, id)).run();
      enqueueChange(tx, 'journal_entry', id, 'delete');
    });

    await sync(deviceA);

    expect(server.get('journal_entries', id)).toMatchObject({ version: 2 });
    expect(server.get('journal_entries', id)?.deleted_at).not.toBeNull();
    expect(outboxCount(deviceA)).toBe(0);
  });
});

describe('conflicts: never silently overwrite the latest text', () => {
  test('keeps the local edit, saves both copies and makes the local copy win everywhere', async () => {
    const { server, deviceA, deviceB, sync } = setup();
    const id = addEntry(deviceA, 'original');
    await sync(deviceA);
    await sync(deviceB);

    editEntry(deviceB, id, 'edited on the iPad');
    await sync(deviceB);
    editEntry(deviceA, id, 'edited on the phone');

    const stats = await sync(deviceA);

    expect(stats.conflicts).toBe(1);
    expect(entry(deviceA, id)?.content).toBe('edited on the phone');
    const conflict = deviceA.select().from(syncConflicts).get();
    expect(conflict).toMatchObject({ entityType: 'journal_entry', entityId: id, resolvedAt: null });
    expect(JSON.parse(conflict?.localJson ?? '{}')).toMatchObject({ content: 'edited on the phone' });
    expect(JSON.parse(conflict?.remoteJson ?? '{}')).toMatchObject({ content: 'edited on the iPad' });
    expect(server.get('journal_entries', id)).toMatchObject({ content: 'edited on the phone', version: 3 });
    expect(outboxCount(deviceA)).toBe(0);

    await sync(deviceB);
    expect(entry(deviceB, id)?.content).toBe('edited on the phone');
  });

  test('does not report a conflict for its own pushes seen again in the overlap window', async () => {
    const { deviceA, sync } = setup();
    const id = addEntry(deviceA, 'first');
    await sync(deviceA);
    editEntry(deviceA, id, 'second');

    const stats = await sync(deviceA);

    expect(stats.conflicts).toBe(0);
    expect(countOpenConflicts(deviceA)).toBe(0);
    expect(entry(deviceA, id)?.content).toBe('second');
  });

  test('identical edits on two devices are not conflicts', async () => {
    const { deviceA, deviceB, sync } = setup();
    const id = addEntry(deviceA, 'draft');
    await sync(deviceA);
    await sync(deviceB);
    editEntry(deviceA, id, 'same words');
    editEntry(deviceB, id, 'same words');
    await sync(deviceA);

    const stats = await sync(deviceB);

    expect(stats.conflicts).toBe(0);
    expect(outboxCount(deviceB)).toBe(0);
  });

  test('a push that loses a race is reconciled and wins on the next sync', async () => {
    const { server, deviceA, sync } = setup();
    const id = addEntry(deviceA, 'base');
    await sync(deviceA);
    editEntry(deviceA, id, 'mine');
    // Another device writes version 2 after our pull but before our push.
    const original = server.write.bind(server);
    let raced = false;
    server.write = (name, payload, conflict) => {
      if (!raced && name === 'journal_entries' && payload.content === 'mine') {
        raced = true;
        original(name, { ...server.get(name, id), content: 'theirs', version: 2 }, 'id');
      }
      return original(name, payload, conflict);
    };

    const first = await sync(deviceA);

    expect(first.conflicts).toBe(1);
    expect(server.get('journal_entries', id)).toMatchObject({ content: 'theirs' });
    expect(entry(deviceA, id)).toMatchObject({ content: 'mine', version: 3 });

    await sync(deviceA);
    expect(server.get('journal_entries', id)).toMatchObject({ content: 'mine', version: 3 });
    expect(outboxCount(deviceA)).toBe(0);
  });

  test('the same verse highlighted on two devices keeps the local highlight and records the other', async () => {
    const { server, deviceB, sync } = setup();
    server.seed('highlights', { id: uuid(), verse_id: 43003016, color: 'gold', version: 1 });
    deviceB.transaction((tx) => {
      const id = uuid();
      tx.run(sql`INSERT INTO highlights (id, verse_id, color, created_at, updated_at) VALUES (${id}, 43003016, 'rose', '2026-11-11T00:00:00.000Z', '2026-11-11T00:00:00.000Z')`);
      enqueueChange(tx, 'highlight', id);
    });

    const stats = await sync(deviceB);

    expect(stats.conflicts).toBe(1);
    const local = deviceB.all<{ color: string }>(sql`SELECT color FROM highlights`);
    expect(local).toEqual([{ color: 'rose' }]);
    // A second sync re-reads the overlap window without recording the collision again.
    await sync(deviceB);
    expect(countOpenConflicts(deviceB)).toBe(1);
  });
});

describe('entity tags (composite keys, hard deletes)', () => {
  function addTag(db: AppDatabase, tagId: string, entryId: string) {
    db.transaction((tx) => {
      tx.run(sql`INSERT OR IGNORE INTO tags (id, name, created_at, updated_at) VALUES (${tagId}, 'Hope', '2026-11-11T00:00:00.000Z', '2026-11-11T00:00:00.000Z')`);
      enqueueChange(tx, 'tag', tagId);
      tx.run(sql`INSERT INTO entity_tags (entity_type, entity_id, tag_id, created_at) VALUES ('journal_entry', ${entryId}, ${tagId}, '2026-11-11T00:00:00.000Z')`);
      enqueueChange(tx, 'entity_tag', `journal_entry:${entryId}:${tagId}`);
    });
  }

  test('tagging, untagging and pulling both ways', async () => {
    const { server, deviceA, deviceB, sync } = setup();
    const entryId = addEntry(deviceA, 'tagged');
    const tagId = uuid();
    addTag(deviceA, tagId, entryId);

    await sync(deviceA);
    expect(server.rows('entity_tags')).toEqual([
      expect.objectContaining({ entity_type: 'journal_entry', entity_id: entryId, tag_id: tagId, deleted_at: null }),
    ]);

    await sync(deviceB);
    expect(deviceB.all(sql`SELECT entity_id, tag_id FROM entity_tags`)).toEqual([{ entity_id: entryId, tag_id: tagId }]);

    deviceA.transaction((tx) => {
      tx.run(sql`DELETE FROM entity_tags WHERE entity_id = ${entryId} AND tag_id = ${tagId}`);
      enqueueChange(tx, 'entity_tag', `journal_entry:${entryId}:${tagId}`, 'delete');
    });
    await sync(deviceA);
    expect(server.rows('entity_tags')[0].deleted_at).not.toBeNull();

    await sync(deviceB);
    expect(deviceB.all(sql`SELECT * FROM entity_tags`)).toEqual([]);

    // Re-tagging revives the server row (same natural key).
    addTag(deviceA, tagId, entryId);
    await sync(deviceA);
    expect(server.rows('entity_tags')).toHaveLength(1);
    expect(server.rows('entity_tags')[0].deleted_at).toBeNull();
  });

  test('drops malformed keys instead of retrying forever', async () => {
    const { deviceA, sync } = setup();
    enqueueChange(deviceA, 'entity_tag', 'not-a-composite-key');

    await sync(deviceA);

    expect(outboxCount(deviceA)).toBe(0);
  });
});

describe('accounts', () => {
  test('a different account on this device starts its sync from scratch', async () => {
    const { deviceA, sync } = setup();
    addEntry(deviceA, 'x');
    await sync(deviceA);
    await sync(deviceA);
    expect(getState(deviceA, stateKeys.cursor('journal_entries'))).not.toBeNull();

    const other = createFakeSupabase('22222222-2222-4222-8222-222222222222');
    await runSync({ db: deviceA, remote: createSupabaseRemote(other.client, '22222222-2222-4222-8222-222222222222'), userId: '22222222-2222-4222-8222-222222222222' });

    expect(getState(deviceA, stateKeys.owner)).toBe('22222222-2222-4222-8222-222222222222');
    expect(other.server.rows('journal_entries')).toHaveLength(0);
  });

  test('after deleting the account, kept local data is queued for the next account', async () => {
    const { deviceA, sync } = setup();
    const kept = addEntry(deviceA, 'kept');
    const removed = addEntry(deviceA, 'removed');
    deleteEntry(deviceA, removed);
    await sync(deviceA);

    prepareLocalDataForNextAccount(deviceA);

    expect(deviceA.all(sql`SELECT entity_type, entity_id FROM outbox`)).toEqual([{ entity_type: 'journal_entry', entity_id: kept }]);
    expect(getState(deviceA, stateKeys.owner)).toBeNull();
    expect(getState(deviceA, stateKeys.cursor('journal_entries'))).toBeNull();
  });
});
