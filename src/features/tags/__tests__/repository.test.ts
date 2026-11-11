import { eq } from 'drizzle-orm';

import { entityTags, outbox, tags } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';

import {
  assignTag,
  entityTagKey,
  getOrCreateTag,
  listAllTags,
  listTagsForEntities,
  listTagsForEntity,
  normalizeTagName,
  removeAllTagsFor,
  unassignTag,
} from '../repository';

describe('normalizeTagName', () => {
  test('trims, collapses whitespace and strips a leading hash', () => {
    expect(normalizeTagName('  #grace   and  truth ')).toBe('grace and truth');
  });

  test('returns an empty string for blank input', () => {
    expect(normalizeTagName('   #  ')).toBe('');
  });

  test('caps very long names', () => {
    expect(normalizeTagName('a'.repeat(100))).toHaveLength(40);
  });
});

describe('getOrCreateTag', () => {
  test('creates a tag once and reuses it case-insensitively', () => {
    const db = createTestDb();

    const first = getOrCreateTag(db, 'Forgiveness');
    const second = getOrCreateTag(db, 'forgiveness ');

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Forgiveness');
    expect(db.select().from(tags).all()).toHaveLength(1);
    expect(db.select().from(outbox).where(eq(outbox.entityType, 'tag')).all()).toHaveLength(1);
  });

  test('revives a soft-deleted tag with the same name', () => {
    const db = createTestDb();
    const tag = getOrCreateTag(db, 'Hope');
    db.update(tags).set({ deletedAt: '2026-01-01T00:00:00.000Z' }).where(eq(tags.id, tag.id)).run();

    const revived = getOrCreateTag(db, 'HOPE');

    expect(revived.id).toBe(tag.id);
    expect(revived.deletedAt).toBeNull();
  });

  test('rejects an empty name', () => {
    const db = createTestDb();
    expect(() => getOrCreateTag(db, '  ')).toThrow('Tag name');
  });
});

describe('assign / unassign', () => {
  test('assigns a tag to an entity idempotently and lists it', () => {
    const db = createTestDb();

    const tag = assignTag(db, 'journal_entry', 'entry-1', 'Peace');
    assignTag(db, 'journal_entry', 'entry-1', 'peace');

    expect(listTagsForEntity(db, 'journal_entry', 'entry-1')).toEqual([expect.objectContaining({ id: tag.id, name: 'Peace' })]);
    expect(db.select().from(entityTags).all()).toHaveLength(1);
    const outboxRows = db.select().from(outbox).where(eq(outbox.entityType, 'entity_tag')).all();
    expect(outboxRows[0]).toEqual(
      expect.objectContaining({ entityId: entityTagKey('journal_entry', 'entry-1', tag.id), operation: 'upsert' }),
    );
  });

  test('unassigns a tag and records a delete in the outbox', () => {
    const db = createTestDb();
    const tag = assignTag(db, 'prayer_entry', 'p1', 'Family');

    unassignTag(db, 'prayer_entry', 'p1', tag.id);

    expect(listTagsForEntity(db, 'prayer_entry', 'p1')).toEqual([]);
    const deletes = db.select().from(outbox).where(eq(outbox.operation, 'delete')).all();
    expect(deletes).toEqual([expect.objectContaining({ entityType: 'entity_tag' })]);
  });

  test('removeAllTagsFor clears every tag of an entity only', () => {
    const db = createTestDb();
    assignTag(db, 'journal_entry', 'a', 'One');
    assignTag(db, 'journal_entry', 'a', 'Two');
    assignTag(db, 'journal_entry', 'b', 'One');

    removeAllTagsFor(db, 'journal_entry', 'a');

    expect(listTagsForEntity(db, 'journal_entry', 'a')).toEqual([]);
    expect(listTagsForEntity(db, 'journal_entry', 'b')).toHaveLength(1);
  });
});

describe('listing', () => {
  test('lists tags for many entities at once, sorted by name', () => {
    const db = createTestDb();
    assignTag(db, 'journal_entry', 'a', 'Zeal');
    assignTag(db, 'journal_entry', 'a', 'Awe');
    assignTag(db, 'journal_entry', 'b', 'Grace');

    const map = listTagsForEntities(db, 'journal_entry', ['a', 'b', 'c']);

    expect(map.get('a')?.map((t) => t.name)).toEqual(['Awe', 'Zeal']);
    expect(map.get('b')?.map((t) => t.name)).toEqual(['Grace']);
    expect(map.get('c')).toBeUndefined();
    expect(listTagsForEntities(db, 'journal_entry', []).size).toBe(0);
  });

  test('lists all tags with usage counts, hiding deleted tags', () => {
    const db = createTestDb();
    assignTag(db, 'journal_entry', 'a', 'Hope');
    assignTag(db, 'prayer_entry', 'p', 'Hope');
    assignTag(db, 'journal_entry', 'a', 'Joy');
    const unused = getOrCreateTag(db, 'Unused');
    const gone = getOrCreateTag(db, 'Gone');
    db.update(tags).set({ deletedAt: '2026-01-01T00:00:00.000Z' }).where(eq(tags.id, gone.id)).run();

    const all = listAllTags(db);

    expect(all).toEqual([
      expect.objectContaining({ name: 'Hope', count: 2 }),
      expect.objectContaining({ name: 'Joy', count: 1 }),
      expect.objectContaining({ id: unused.id, name: 'Unused', count: 0 }),
    ]);
  });
});
