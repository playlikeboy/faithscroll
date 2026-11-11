/**
 * Links between pieces of user content (sermons, journal entries, prayers, action items, notes…).
 * Stored as directed rows but treated as undirected: A→B and B→A are the same link.
 */
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { entityLinks, type LinkableType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

import { entityKey, resolveEntities, type EntityRef, type ResolvedEntity } from './resolve';

export type EntityLink = typeof entityLinks.$inferSelect;

export interface LinkedItem extends ResolvedEntity {
  linkId: string;
}

function between(a: EntityRef, b: EntityRef) {
  return or(
    and(eq(entityLinks.fromType, a.type), eq(entityLinks.fromId, a.id), eq(entityLinks.toType, b.type), eq(entityLinks.toId, b.id)),
    and(eq(entityLinks.fromType, b.type), eq(entityLinks.fromId, b.id), eq(entityLinks.toType, a.type), eq(entityLinks.toId, a.id)),
  );
}

function touching(ref: EntityRef) {
  return or(
    and(eq(entityLinks.fromType, ref.type), eq(entityLinks.fromId, ref.id)),
    and(eq(entityLinks.toType, ref.type), eq(entityLinks.toId, ref.id)),
  );
}

function tombstoneLink(db: AppDatabase, id: string): void {
  const result = db
    .update(entityLinks)
    .set(tombstone(entityLinks.version))
    .where(and(eq(entityLinks.id, id), isNull(entityLinks.deletedAt)))
    .run();
  if (result.changes > 0) enqueueChange(db, 'entity_link', id, 'delete');
}

/**
 * Link two items. Idempotent in both directions; revives a previously removed link.
 * Does not open a transaction (safe inside a caller's). Returns the link id.
 */
export function createLinkRow(db: AppDatabase, from: EntityRef, to: EntityRef): string {
  if (from.type === to.type && from.id === to.id) throw new Error('An item cannot be linked to itself');

  const existing = db.select().from(entityLinks).where(between(from, to)).all();
  const live = existing.find((row) => row.deletedAt === null);
  if (live) return live.id;

  const removed = existing[0];
  if (removed) {
    db.update(entityLinks).set({ deletedAt: null, ...touch(entityLinks.version) }).where(eq(entityLinks.id, removed.id)).run();
    enqueueChange(db, 'entity_link', removed.id, 'upsert');
    return removed.id;
  }

  const id = newId();
  db.insert(entityLinks).values({ id, fromType: from.type, fromId: from.id, toType: to.type, toId: to.id }).run();
  enqueueChange(db, 'entity_link', id, 'upsert');
  return id;
}

export function createLink(db: AppDatabase, from: EntityRef, to: EntityRef): string {
  return db.transaction((tx) => createLinkRow(tx, from, to));
}

export function removeLink(db: AppDatabase, linkId: string): void {
  db.transaction((tx) => tombstoneLink(tx, linkId));
}

export function removeLinkBetween(db: AppDatabase, a: EntityRef, b: EntityRef): void {
  db.transaction((tx) => {
    const rows = tx.select({ id: entityLinks.id }).from(entityLinks).where(and(between(a, b), isNull(entityLinks.deletedAt))).all();
    for (const row of rows) tombstoneLink(tx, row.id);
  });
}

/** Remove every link touching an item (used when it is deleted). Call inside a transaction. */
export function removeAllLinksFor(db: AppDatabase, ref: EntityRef): void {
  const rows = db.select({ id: entityLinks.id }).from(entityLinks).where(and(touching(ref), isNull(entityLinks.deletedAt))).all();
  for (const row of rows) tombstoneLink(db, row.id);
}

function otherSide(link: EntityLink, self: EntityRef): EntityRef {
  const isFrom = link.fromType === self.type && link.fromId === self.id;
  return isFrom ? { type: link.toType, id: link.toId } : { type: link.fromType, id: link.fromId };
}

/** Everything linked to an item (either direction), with titles. Oldest link first. */
export function listLinks(db: AppDatabase, self: EntityRef): LinkedItem[] {
  const rows = db
    .select()
    .from(entityLinks)
    .where(and(touching(self), isNull(entityLinks.deletedAt)))
    .orderBy(entityLinks.createdAt)
    .all();
  const others = rows.map((row) => ({ linkId: row.id, ref: otherSide(row, self) }));
  const resolved = resolveEntities(
    db,
    others.map((o) => o.ref),
  );
  return others.flatMap(({ linkId, ref }) => {
    const entity = resolved.get(entityKey(ref));
    return entity ? [{ ...entity, linkId }] : [];
  });
}

/** Number of live links per item for many items of one type (timeline badges). */
export function countLinksFor(db: AppDatabase, type: LinkableType, ids: readonly string[]): Map<string, number> {
  if (ids.length === 0) return new Map();
  const idList = [...ids];
  const rows = db
    .select()
    .from(entityLinks)
    .where(
      and(
        isNull(entityLinks.deletedAt),
        or(
          and(eq(entityLinks.fromType, type), inArray(entityLinks.fromId, idList)),
          and(eq(entityLinks.toType, type), inArray(entityLinks.toId, idList)),
        ),
      ),
    )
    .all();
  const wanted = new Set(idList);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.fromType === type && wanted.has(row.fromId)) counts.set(row.fromId, (counts.get(row.fromId) ?? 0) + 1);
    if (row.toType === type && wanted.has(row.toId)) counts.set(row.toId, (counts.get(row.toId) ?? 0) + 1);
  }
  return counts;
}
