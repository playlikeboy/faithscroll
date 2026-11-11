import { eq } from 'drizzle-orm';

import { entityTags, journalEntries, outbox, sermons } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import { listLinks, createLink } from '@/features/links/repository';
import { listScriptureReferences } from '@/features/links/scripture-references';
import { assignTag } from '@/features/tags/repository';

import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from '../repository';

jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));

describe('createJournalEntry', () => {
  test('creates an entry with defaults and records it in the outbox', () => {
    const db = createTestDb();

    const entry = createJournalEntry(db, { title: 'Morning', content: 'Quiet', entryDate: '2026-11-10' });

    expect(entry).toEqual(expect.objectContaining({ title: 'Morning', content: 'Quiet', entryType: 'personal', entryDate: '2026-11-10' }));
    expect(getJournalEntry(db, entry.id)?.id).toBe(entry.id);
    expect(db.select().from(outbox).where(eq(outbox.entityId, entry.id)).all()).toHaveLength(1);
  });

  test('defaults the entry date to today (local)', () => {
    const db = createTestDb();
    const entry = createJournalEntry(db, {});
    expect(entry.entryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('attaches passages and links in the same transaction', () => {
    const db = createTestDb();
    db.insert(sermons).values({ id: 's1', title: 'Grace' }).run();

    const entry = createJournalEntry(
      db,
      { entryType: 'sermon_reflection', content: 'Notes' },
      { passages: [{ startVerseId: 45008028, endVerseId: 45008028 }], links: [{ type: 'sermon', id: 's1' }] },
    );

    expect(listScriptureReferences(db, 'journal_entry', entry.id)).toEqual([expect.objectContaining({ referenceText: 'Romans 8:28' })]);
    expect(listLinks(db, { type: 'journal_entry', id: entry.id })).toEqual([expect.objectContaining({ type: 'sermon', id: 's1' })]);
  });

  test('rejects an invalid type or date', () => {
    const db = createTestDb();
    expect(() => createJournalEntry(db, { entryDate: '10/11/2026' })).toThrow('date');
    // @ts-expect-error — invalid entry type on purpose
    expect(() => createJournalEntry(db, { entryType: 'diary' })).toThrow('type');
  });
});

describe('updateJournalEntry', () => {
  test('applies changes, bumps the version and enqueues an upsert', () => {
    const db = createTestDb();
    const entry = createJournalEntry(db, { title: 'Draft' });

    updateJournalEntry(db, entry.id, { title: 'Final', content: 'Body', entryType: 'gratitude', prompt: 'What am I grateful for?' });

    const row = getJournalEntry(db, entry.id);
    expect(row).toEqual(expect.objectContaining({ title: 'Final', content: 'Body', entryType: 'gratitude', prompt: 'What am I grateful for?', version: 2 }));
    expect(db.select().from(outbox).where(eq(outbox.entityId, entry.id)).all()).toHaveLength(2);
  });

  test('throws for a missing or deleted entry', () => {
    const db = createTestDb();
    const entry = createJournalEntry(db, {});
    deleteJournalEntry(db, entry.id);
    expect(() => updateJournalEntry(db, entry.id, { title: 'x' })).toThrow('not found');
    expect(() => updateJournalEntry(db, 'nope', { title: 'x' })).toThrow('not found');
  });
});

describe('listJournalEntries', () => {
  function seed() {
    const db = createTestDb();
    createJournalEntry(db, { title: 'Older', content: 'Forgiveness is hard', entryDate: '2026-11-01', entryType: 'reflection' });
    createJournalEntry(db, { title: 'Grateful', content: 'Sunlight', entryDate: '2026-11-09', entryType: 'gratitude' });
    createJournalEntry(db, { title: '100% honest', content: 'snake_case', entryDate: '2026-11-10', entryType: 'personal' });
    return db;
  }

  test('lists newest first and hides deleted entries', () => {
    const db = seed();
    const gone = createJournalEntry(db, { title: 'Gone', entryDate: '2026-11-11' });
    deleteJournalEntry(db, gone.id);

    expect(listJournalEntries(db).map((e) => e.title)).toEqual(['100% honest', 'Grateful', 'Older']);
  });

  test('filters by type', () => {
    const db = seed();
    expect(listJournalEntries(db, { type: 'gratitude' }).map((e) => e.title)).toEqual(['Grateful']);
  });

  test('searches title and content case-insensitively, matching wildcards literally', () => {
    const db = seed();
    expect(listJournalEntries(db, { search: 'FORGIVE' }).map((e) => e.title)).toEqual(['Older']);
    expect(listJournalEntries(db, { search: '100%' }).map((e) => e.title)).toEqual(['100% honest']);
    expect(listJournalEntries(db, { search: 'e_c' }).map((e) => e.title)).toEqual(['100% honest']);
    expect(listJournalEntries(db, { search: '%' }).map((e) => e.title)).toEqual(['100% honest']);
    expect(listJournalEntries(db, { search: '   ' })).toHaveLength(3);
  });

  test('paginates', () => {
    const db = seed();
    expect(listJournalEntries(db, { limit: 2 }).map((e) => e.title)).toEqual(['100% honest', 'Grateful']);
    expect(listJournalEntries(db, { limit: 2, offset: 2 }).map((e) => e.title)).toEqual(['Older']);
  });
});

describe('deleteJournalEntry', () => {
  test('soft-deletes the entry and clears its links, passages and tags', () => {
    const db = createTestDb();
    db.insert(sermons).values({ id: 's1', title: 'Grace' }).run();
    const entry = createJournalEntry(db, { title: 'Bye' }, { passages: [{ startVerseId: 45008028, endVerseId: 45008028 }] });
    createLink(db, { type: 'sermon', id: 's1' }, { type: 'journal_entry', id: entry.id });
    assignTag(db, 'journal_entry', entry.id, 'Hope');

    deleteJournalEntry(db, entry.id);

    expect(getJournalEntry(db, entry.id)).toBeNull();
    const row = db.select().from(journalEntries).where(eq(journalEntries.id, entry.id)).get();
    expect(row?.deletedAt).not.toBeNull();
    expect(listLinks(db, { type: 'sermon', id: 's1' })).toEqual([]);
    expect(listScriptureReferences(db, 'journal_entry', entry.id)).toEqual([]);
    expect(db.select().from(entityTags).all()).toEqual([]);
    expect(db.select().from(outbox).where(eq(outbox.operation, 'delete')).all().map((r) => r.entityType)).toEqual(
      expect.arrayContaining(['journal_entry', 'entity_link', 'scripture_reference', 'entity_tag']),
    );
  });

  test('is a no-op for an unknown id', () => {
    const db = createTestDb();
    expect(() => deleteJournalEntry(db, 'missing')).not.toThrow();
  });
});
