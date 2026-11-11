import { and, asc, eq, isNull, max, sql } from 'drizzle-orm';
import { z } from 'zod';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { collectionItems, collections, type LinkableType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

export type CollectionRow = typeof collections.$inferSelect;
export type CollectionItemRow = typeof collectionItems.$inferSelect;

export const MAX_COLLECTION_TITLE_LENGTH = 80;

const collectionInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give your collection a name.')
    .max(MAX_COLLECTION_TITLE_LENGTH, `Keep the name under ${MAX_COLLECTION_TITLE_LENGTH} characters.`),
  description: z.string().trim().max(500).nullish(),
});

export type CollectionInput = z.input<typeof collectionInputSchema>;

function parseInput(input: CollectionInput): { title: string; description: string | null } {
  const result = collectionInputSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Invalid collection.');
  return { title: result.data.title, description: result.data.description || null };
}

export function createCollection(db: AppDatabase, input: CollectionInput): string {
  const values = parseInput(input);
  const id = newId();
  db.transaction((tx) => {
    tx.insert(collections).values({ id, ...values }).run();
    enqueueChange(tx, 'collection', id, 'upsert');
  });
  return id;
}

export function getCollection(db: AppDatabase, id: string): CollectionRow | undefined {
  return db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
    .get();
}

export function updateCollection(db: AppDatabase, id: string, input: CollectionInput): void {
  const values = parseInput(input);
  db.transaction((tx) => {
    if (!getCollection(tx, id)) throw new Error('This collection no longer exists.');
    tx.update(collections)
      .set({ ...values, ...touch(collections.version) })
      .where(eq(collections.id, id))
      .run();
    enqueueChange(tx, 'collection', id, 'upsert');
  });
}

/** Soft-delete a collection and its live items. */
export function deleteCollection(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    if (!getCollection(tx, id)) return;
    const items = tx
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(and(eq(collectionItems.collectionId, id), isNull(collectionItems.deletedAt)))
      .all();
    for (const item of items) {
      tx.update(collectionItems).set(tombstone(collectionItems.version)).where(eq(collectionItems.id, item.id)).run();
      enqueueChange(tx, 'collection_item', item.id, 'delete');
    }
    tx.update(collections).set(tombstone(collections.version)).where(eq(collections.id, id)).run();
    enqueueChange(tx, 'collection', id, 'delete');
  });
}

/** Live collections, alphabetical. Returns a query. */
export function listCollections(db: AppDatabase) {
  return db
    .select()
    .from(collections)
    .where(isNull(collections.deletedAt))
    .orderBy(asc(sql`lower(${collections.title})`));
}

/** Live items of a collection in display order. Returns a query. */
export function listCollectionItems(db: AppDatabase, collectionId: string) {
  return db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.collectionId, collectionId), isNull(collectionItems.deletedAt)))
    .orderBy(asc(collectionItems.sortOrder));
}

/** Every live collection item (use to compute counts alongside `listCollections`). Returns a query. */
export function listAllCollectionItems(db: AppDatabase) {
  return db
    .select({ id: collectionItems.id, collectionId: collectionItems.collectionId })
    .from(collectionItems)
    .where(isNull(collectionItems.deletedAt));
}

/** Collection ids that currently contain the entity. Returns a query. */
export function listCollectionIdsContaining(db: AppDatabase, entityType: LinkableType, entityId: string) {
  return db
    .select({ collectionId: collectionItems.collectionId })
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.entityType, entityType),
        eq(collectionItems.entityId, entityId),
        isNull(collectionItems.deletedAt),
      ),
    );
}

function nextSortOrder(db: AppDatabase, collectionId: string): number {
  const row = db
    .select({ value: max(collectionItems.sortOrder) })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId))
    .get();
  return row?.value === null || row?.value === undefined ? 0 : row.value + 1;
}

/** Add an entity to a collection (idempotent; revives a removed item at the end). Returns the item id. */
export function addToCollection(
  db: AppDatabase,
  collectionId: string,
  entityType: LinkableType,
  entityId: string,
): string {
  return db.transaction((tx) => {
    if (!getCollection(tx, collectionId)) throw new Error('This collection no longer exists.');
    const existing = tx
      .select()
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.entityType, entityType),
          eq(collectionItems.entityId, entityId),
        ),
      )
      .get();
    if (existing && existing.deletedAt === null) return existing.id;
    const sortOrder = nextSortOrder(tx, collectionId);
    if (existing) {
      tx.update(collectionItems)
        .set({ deletedAt: null, sortOrder, ...touch(collectionItems.version) })
        .where(eq(collectionItems.id, existing.id))
        .run();
      enqueueChange(tx, 'collection_item', existing.id, 'upsert');
      return existing.id;
    }
    const id = newId();
    tx.insert(collectionItems).values({ id, collectionId, entityType, entityId, sortOrder }).run();
    enqueueChange(tx, 'collection_item', id, 'upsert');
    return id;
  });
}

export function removeFromCollection(
  db: AppDatabase,
  collectionId: string,
  entityType: LinkableType,
  entityId: string,
): void {
  db.transaction((tx) => {
    const item = tx
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.entityType, entityType),
          eq(collectionItems.entityId, entityId),
          isNull(collectionItems.deletedAt),
        ),
      )
      .get();
    if (!item) return;
    tx.update(collectionItems).set(tombstone(collectionItems.version)).where(eq(collectionItems.id, item.id)).run();
    enqueueChange(tx, 'collection_item', item.id, 'delete');
  });
}
