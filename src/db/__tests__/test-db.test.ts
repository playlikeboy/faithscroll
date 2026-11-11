import { eq } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { journalEntries, outbox, sermonNotes, sermons } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import { newId } from '@/lib/ids';

describe('test database harness', () => {
  test('applies migrations and round-trips a journal entry', () => {
    const db = createTestDb();
    const id = newId();

    db.insert(journalEntries).values({ id, title: 'Grace', content: 'Body', entryDate: '2026-11-10' }).run();
    const row = db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();

    expect(row?.title).toBe('Grace');
    expect(row?.version).toBe(1);
    expect(row?.deletedAt).toBeNull();
  });

  test('touch bumps version and tombstone soft-deletes', () => {
    const db = createTestDb();
    const id = newId();
    db.insert(journalEntries).values({ id, entryDate: '2026-11-10' }).run();

    db.update(journalEntries).set({ title: 'Edited', ...touch(journalEntries.version) }).where(eq(journalEntries.id, id)).run();
    db.update(journalEntries).set(tombstone(journalEntries.version)).where(eq(journalEntries.id, id)).run();

    const row = db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();
    expect(row?.version).toBe(3);
    expect(row?.deletedAt).not.toBeNull();
  });

  test('cascades sermon deletion to notes (foreign keys on)', () => {
    const db = createTestDb();
    const sermonId = newId();
    db.insert(sermons).values({ id: sermonId, title: 'The Power of Forgiveness' }).run();
    db.insert(sermonNotes).values({ id: newId(), sermonId, content: '# Notes' }).run();

    db.delete(sermons).where(eq(sermons.id, sermonId)).run();

    expect(db.select().from(sermonNotes).all()).toHaveLength(0);
  });

  test('enqueueChange records an outbox row', () => {
    const db = createTestDb();
    enqueueChange(db, 'journal_entry', 'abc', 'delete');
    const rows = db.select().from(outbox).all();
    expect(rows).toEqual([expect.objectContaining({ entityType: 'journal_entry', entityId: 'abc', operation: 'delete' })]);
  });
});

describe('newId', () => {
  test('returns unique v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
