/**
 * Tags: case-insensitive, reusable labels that can be attached to any linkable entity.
 * `entity_tags` rows have no sync columns, so they are hard-deleted; the outbox records them
 * with a composite key (see `entityTagKey`).
 */
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';

import { enqueueChange, touch } from '@/db/mutations';
import { entityTags, tags, type LinkableType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

export type Tag = typeof tags.$inferSelect;

export interface TagWithCount {
  id: string;
  name: string;
  count: number;
}

export const MAX_TAG_LENGTH = 40;

/** Trim, collapse whitespace, drop a leading "#" and cap the length. */
export function normalizeTagName(input: string): string {
  return input.replace(/^\s*#+/, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH).trim();
}

/** Outbox id for an `entity_tags` row (composite primary key). */
export function entityTagKey(entityType: LinkableType, entityId: string, tagId: string): string {
  return `${entityType}:${entityId}:${tagId}`;
}

function findTagByName(db: AppDatabase, name: string): Tag | undefined {
  return db
    .select()
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name})`)
    .get();
}

function getOrCreateTagRow(db: AppDatabase, rawName: string): Tag {
  const name = normalizeTagName(rawName);
  if (!name) throw new Error('Tag name cannot be empty');

  const existing = findTagByName(db, name);
  if (existing && existing.deletedAt === null) return existing;

  if (existing) {
    db.update(tags).set({ deletedAt: null, ...touch(tags.version) }).where(eq(tags.id, existing.id)).run();
    enqueueChange(db, 'tag', existing.id, 'upsert');
    return { ...existing, deletedAt: null };
  }

  const id = newId();
  db.insert(tags).values({ id, name }).run();
  enqueueChange(db, 'tag', id, 'upsert');
  const created = db.select().from(tags).where(eq(tags.id, id)).get();
  if (!created) throw new Error('Could not create tag');
  return created;
}

/** Find a tag by name (case-insensitive) or create it. Revives a soft-deleted tag of the same name. */
export function getOrCreateTag(db: AppDatabase, rawName: string): Tag {
  return db.transaction((tx) => getOrCreateTagRow(tx, rawName));
}

/** Attach a tag (by name) to an entity. Idempotent. Returns the tag. */
export function assignTag(db: AppDatabase, entityType: LinkableType, entityId: string, rawName: string): Tag {
  return db.transaction((tx) => {
    const tag = getOrCreateTagRow(tx, rawName);
    const inserted = tx
      .insert(entityTags)
      .values({ entityType, entityId, tagId: tag.id })
      .onConflictDoNothing()
      .run();
    if (inserted.changes > 0) enqueueChange(tx, 'entity_tag', entityTagKey(entityType, entityId, tag.id), 'upsert');
    return tag;
  });
}

function deleteEntityTag(db: AppDatabase, entityType: LinkableType, entityId: string, tagId: string): void {
  const result = db
    .delete(entityTags)
    .where(and(eq(entityTags.entityType, entityType), eq(entityTags.entityId, entityId), eq(entityTags.tagId, tagId)))
    .run();
  if (result.changes > 0) enqueueChange(db, 'entity_tag', entityTagKey(entityType, entityId, tagId), 'delete');
}

export function unassignTag(db: AppDatabase, entityType: LinkableType, entityId: string, tagId: string): void {
  db.transaction((tx) => deleteEntityTag(tx, entityType, entityId, tagId));
}

/**
 * Remove every tag from an entity (used when the entity is deleted).
 * Does not open its own transaction: call it inside the caller's transaction.
 */
export function removeAllTagsFor(db: AppDatabase, entityType: LinkableType, entityId: string): void {
  const rows = db
    .select({ tagId: entityTags.tagId })
    .from(entityTags)
    .where(and(eq(entityTags.entityType, entityType), eq(entityTags.entityId, entityId)))
    .all();
  for (const row of rows) deleteEntityTag(db, entityType, entityId, row.tagId);
}

export function listTagsForEntity(db: AppDatabase, entityType: LinkableType, entityId: string): Tag[] {
  return db
    .select({ tag: tags })
    .from(entityTags)
    .innerJoin(tags, eq(tags.id, entityTags.tagId))
    .where(and(eq(entityTags.entityType, entityType), eq(entityTags.entityId, entityId), isNull(tags.deletedAt)))
    .orderBy(asc(sql`lower(${tags.name})`))
    .all()
    .map((row) => row.tag);
}

/** Tags for many entities of one type at once (timeline cards). Entities without tags are absent. */
export function listTagsForEntities(
  db: AppDatabase,
  entityType: LinkableType,
  entityIds: readonly string[],
): Map<string, Tag[]> {
  if (entityIds.length === 0) return new Map();
  const rows = db
    .select({ entityId: entityTags.entityId, tag: tags })
    .from(entityTags)
    .innerJoin(tags, eq(tags.id, entityTags.tagId))
    .where(and(eq(entityTags.entityType, entityType), inArray(entityTags.entityId, [...entityIds]), isNull(tags.deletedAt)))
    .orderBy(asc(sql`lower(${tags.name})`))
    .all();
  const grouped = new Map<string, Tag[]>();
  for (const row of rows) grouped.set(row.entityId, [...(grouped.get(row.entityId) ?? []), row.tag]);
  return grouped;
}

/** Every live tag with the number of entities using it, most used first. */
export function listAllTags(db: AppDatabase): TagWithCount[] {
  return db
    .select({ id: tags.id, name: tags.name, count: count(entityTags.tagId) })
    .from(tags)
    .leftJoin(entityTags, eq(entityTags.tagId, tags.id))
    .where(isNull(tags.deletedAt))
    .groupBy(tags.id)
    .orderBy(sql`count(${entityTags.tagId}) desc`, asc(sql`lower(${tags.name})`))
    .all();
}
