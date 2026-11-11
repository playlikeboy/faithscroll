import { collectionItems, outbox } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import {
  addToCollection,
  createCollection,
  deleteCollection,
  getCollection,
  listCollectionIdsContaining,
  listCollectionItems,
  listCollections,
  removeFromCollection,
  updateCollection,
} from '@/features/bible/annotations/collections';

describe('collections repository', () => {
  test('creates a collection with a trimmed title', () => {
    const db = createTestDb();

    const id = createCollection(db, { title: '  Psalms of comfort  ', description: 'For hard days' });

    expect(getCollection(db, id)).toEqual(
      expect.objectContaining({ title: 'Psalms of comfort', description: 'For hard days' }),
    );
    expect(db.select().from(outbox).all()[0]).toEqual(
      expect.objectContaining({ entityType: 'collection', entityId: id }),
    );
  });

  test('rejects an empty title', () => {
    const db = createTestDb();
    expect(() => createCollection(db, { title: '   ' })).toThrow(/name/i);
  });

  test('renames and deletes a collection', () => {
    const db = createTestDb();
    const id = createCollection(db, { title: 'Hope' });

    updateCollection(db, id, { title: 'Hope & peace' });
    expect(getCollection(db, id)?.title).toBe('Hope & peace');
    expect(getCollection(db, id)?.version).toBe(2);

    deleteCollection(db, id);
    expect(getCollection(db, id)).toBeUndefined();
    expect(listCollections(db).all()).toEqual([]);
  });

  test('deleting a collection tombstones its items', () => {
    const db = createTestDb();
    const id = createCollection(db, { title: 'Hope' });
    addToCollection(db, id, 'saved_verse', 'sv-1');

    deleteCollection(db, id);

    expect(listCollectionItems(db, id).all()).toEqual([]);
    expect(db.select().from(collectionItems).all()[0].deletedAt).not.toBeNull();
  });

  test('adds items in order, ignores duplicates and revives removed items', () => {
    const db = createTestDb();
    const id = createCollection(db, { title: 'Hope' });

    const first = addToCollection(db, id, 'saved_verse', 'sv-1');
    const second = addToCollection(db, id, 'journal_entry', 'je-1');
    expect(addToCollection(db, id, 'saved_verse', 'sv-1')).toBe(first);

    removeFromCollection(db, id, 'saved_verse', 'sv-1');
    expect(listCollectionItems(db, id).all().map((item) => item.id)).toEqual([second]);

    expect(addToCollection(db, id, 'saved_verse', 'sv-1')).toBe(first);
    const items = listCollectionItems(db, id).all();
    expect(items.map((item) => item.entityId)).toEqual(['je-1', 'sv-1']);
    expect(items.map((item) => item.sortOrder)).toEqual([1, 2]);
  });

  test('adding to a missing collection fails clearly', () => {
    const db = createTestDb();
    expect(() => addToCollection(db, 'nope', 'saved_verse', 'sv-1')).toThrow(/collection/i);
  });

  test('lists collections containing an entity', () => {
    const db = createTestDb();
    const a = createCollection(db, { title: 'A' });
    const b = createCollection(db, { title: 'B' });
    addToCollection(db, a, 'saved_verse', 'sv-1');
    addToCollection(db, b, 'saved_verse', 'sv-2');

    expect(listCollectionIdsContaining(db, 'saved_verse', 'sv-1').all().map((row) => row.collectionId)).toEqual([a]);
  });

  test('removing an item that is not there is a no-op', () => {
    const db = createTestDb();
    const id = createCollection(db, { title: 'A' });
    removeFromCollection(db, id, 'saved_verse', 'missing');
    expect(db.select().from(outbox).all()).toHaveLength(1);
  });
});
