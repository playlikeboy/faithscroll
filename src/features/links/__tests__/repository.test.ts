import { eq } from 'drizzle-orm';

import { actionItems, entityLinks, journalEntries, outbox, prayerEntries, sermons, verseNotes } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';

import { countLinksFor, createLink, listLinks, removeAllLinksFor, removeLink, removeLinkBetween } from '../repository';

// formatReference belongs to bible-data; pin it so the local fallback formatter is exercised.
jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));

function seed(db: AppDatabase) {
  db.insert(sermons).values({ id: 's1', title: 'The Power of Forgiveness', speaker: 'Pastor John', sermonDate: '2026-11-08' }).run();
  db.insert(journalEntries).values({ id: 'j1', title: 'Seventy times seven', entryDate: '2026-11-09', entryType: 'sermon_reflection' }).run();
  db.insert(journalEntries).values({ id: 'j2', title: '', content: '**Grace** came quietly today.', entryDate: '2026-11-10' }).run();
  db.insert(prayerEntries).values({ id: 'p1', title: 'For my brother', status: 'praying' }).run();
  db.insert(actionItems).values({ id: 'a1', title: 'Call Sam and forgive' }).run();
  db.insert(verseNotes).values({ id: 'n1', startVerseId: 40018021, endVerseId: 40018022, content: 'Peter asks' }).run();
}

describe('createLink', () => {
  test('creates a link once regardless of direction and records it in the outbox', () => {
    const db = createTestDb();
    seed(db);

    const id = createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'sermon', id: 's1' });
    const again = createLink(db, { type: 'sermon', id: 's1' }, { type: 'journal_entry', id: 'j1' });

    expect(again).toBe(id);
    expect(db.select().from(entityLinks).all()).toHaveLength(1);
    expect(db.select().from(outbox).where(eq(outbox.entityType, 'entity_link')).all()).toHaveLength(1);
  });

  test('refuses to link an item to itself', () => {
    const db = createTestDb();
    expect(() => createLink(db, { type: 'journal_entry', id: 'x' }, { type: 'journal_entry', id: 'x' })).toThrow();
  });

  test('revives a removed link instead of duplicating it', () => {
    const db = createTestDb();
    seed(db);
    const id = createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'prayer_entry', id: 'p1' });
    removeLink(db, id);

    const revived = createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'prayer_entry', id: 'p1' });

    expect(revived).toBe(id);
    expect(listLinks(db, { type: 'journal_entry', id: 'j1' })).toHaveLength(1);
  });
});

describe('listLinks', () => {
  test('lists links in both directions with resolved titles', () => {
    const db = createTestDb();
    seed(db);
    createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'sermon', id: 's1' });
    createLink(db, { type: 'prayer_entry', id: 'p1' }, { type: 'journal_entry', id: 'j1' });
    createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'action_item', id: 'a1' });
    createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'journal_entry', id: 'j2' });
    createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'verse_note', id: 'n1' });

    const items = listLinks(db, { type: 'journal_entry', id: 'j1' });

    expect(items.map((i) => [i.type, i.id, i.title])).toEqual(
      expect.arrayContaining([
        ['sermon', 's1', 'The Power of Forgiveness'],
        ['prayer_entry', 'p1', 'For my brother'],
        ['action_item', 'a1', 'Call Sam and forgive'],
        ['journal_entry', 'j2', 'Grace came quietly today.'],
        ['verse_note', 'n1', expect.stringContaining('Matthew 18:21')],
      ]),
    );
    expect(items.find((i) => i.type === 'sermon')?.subtitle).toContain('Pastor John');

    const fromSermon = listLinks(db, { type: 'sermon', id: 's1' });
    expect(fromSermon).toEqual([expect.objectContaining({ type: 'journal_entry', id: 'j1', title: 'Seventy times seven' })]);
  });

  test('hides links to deleted items', () => {
    const db = createTestDb();
    seed(db);
    createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'prayer_entry', id: 'p1' });
    db.update(prayerEntries).set({ deletedAt: '2026-11-10T00:00:00.000Z' }).where(eq(prayerEntries.id, 'p1')).run();

    expect(listLinks(db, { type: 'journal_entry', id: 'j1' })).toEqual([]);
  });
});

describe('removing links', () => {
  test('removeLinkBetween tombstones the link in either direction', () => {
    const db = createTestDb();
    seed(db);
    createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'sermon', id: 's1' });

    removeLinkBetween(db, { type: 'sermon', id: 's1' }, { type: 'journal_entry', id: 'j1' });

    expect(listLinks(db, { type: 'journal_entry', id: 'j1' })).toEqual([]);
    const row = db.select().from(entityLinks).get();
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.version).toBe(2);
  });

  test('removeAllLinksFor removes every link touching an entity', () => {
    const db = createTestDb();
    seed(db);
    createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'sermon', id: 's1' });
    createLink(db, { type: 'prayer_entry', id: 'p1' }, { type: 'journal_entry', id: 'j1' });
    createLink(db, { type: 'prayer_entry', id: 'p1' }, { type: 'sermon', id: 's1' });

    removeAllLinksFor(db, { type: 'journal_entry', id: 'j1' });

    expect(listLinks(db, { type: 'journal_entry', id: 'j1' })).toEqual([]);
    expect(listLinks(db, { type: 'prayer_entry', id: 'p1' })).toHaveLength(1);
  });

  test('countLinksFor counts live links per entity', () => {
    const db = createTestDb();
    seed(db);
    createLink(db, { type: 'journal_entry', id: 'j1' }, { type: 'sermon', id: 's1' });
    createLink(db, { type: 'prayer_entry', id: 'p1' }, { type: 'journal_entry', id: 'j1' });
    const removed = createLink(db, { type: 'journal_entry', id: 'j2' }, { type: 'sermon', id: 's1' });
    removeLink(db, removed);

    const counts = countLinksFor(db, 'journal_entry', ['j1', 'j2']);

    expect(counts.get('j1')).toBe(2);
    expect(counts.get('j2')).toBeUndefined();
    expect(countLinksFor(db, 'journal_entry', []).size).toBe(0);
  });
});
