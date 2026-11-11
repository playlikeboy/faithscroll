/**
 * Scripture passages attached to user content (journal entries, prayers, action items…).
 * Rows are syncable: soft-deleted with a tombstone, revived when the same passage is re-attached.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { REFERENCE_SOURCE_TYPES, scriptureReferences } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

import { describeVerseRange } from './reference-text';

export type ScriptureReference = typeof scriptureReferences.$inferSelect;
export type ReferenceSourceType = (typeof REFERENCE_SOURCE_TYPES)[number];

export interface AttachReferenceInput {
  sourceType: ReferenceSourceType;
  sourceId: string;
  startVerseId: number;
  endVerseId: number;
  /** Display text; derived from the range when omitted. */
  referenceText?: string;
}

function liveForSource(sourceType: ReferenceSourceType, sourceId: string) {
  return and(
    eq(scriptureReferences.sourceType, sourceType),
    eq(scriptureReferences.sourceId, sourceId),
    isNull(scriptureReferences.deletedAt),
  );
}

function getById(db: AppDatabase, id: string): ScriptureReference {
  const row = db.select().from(scriptureReferences).where(eq(scriptureReferences.id, id)).get();
  if (!row) throw new Error('Scripture reference not found');
  return row;
}

/**
 * Attach a passage to a source. Idempotent per (source, range): returns the existing row,
 * reviving it if it had been detached. Does not open a transaction (safe inside a caller's).
 */
export function attachScriptureReferenceRow(db: AppDatabase, input: AttachReferenceInput): ScriptureReference {
  const startVerseId = Math.min(input.startVerseId, input.endVerseId);
  const endVerseId = Math.max(input.startVerseId, input.endVerseId);
  const referenceText = input.referenceText?.trim() || describeVerseRange(startVerseId, endVerseId);

  const existing = db
    .select()
    .from(scriptureReferences)
    .where(
      and(
        eq(scriptureReferences.sourceType, input.sourceType),
        eq(scriptureReferences.sourceId, input.sourceId),
        eq(scriptureReferences.startVerseId, startVerseId),
        eq(scriptureReferences.endVerseId, endVerseId),
      ),
    )
    .get();

  if (existing && existing.deletedAt === null) return existing;

  if (existing) {
    db.update(scriptureReferences)
      .set({ deletedAt: null, referenceText, ...touch(scriptureReferences.version) })
      .where(eq(scriptureReferences.id, existing.id))
      .run();
    enqueueChange(db, 'scripture_reference', existing.id, 'upsert');
    return getById(db, existing.id);
  }

  const id = newId();
  db.insert(scriptureReferences)
    .values({ id, sourceType: input.sourceType, sourceId: input.sourceId, startVerseId, endVerseId, referenceText, origin: 'user' })
    .run();
  enqueueChange(db, 'scripture_reference', id, 'upsert');
  return getById(db, id);
}

export function attachScriptureReference(db: AppDatabase, input: AttachReferenceInput): ScriptureReference {
  return db.transaction((tx) => attachScriptureReferenceRow(tx, input));
}

export function detachScriptureReference(db: AppDatabase, id: string): void {
  db.transaction((tx) => {
    const result = tx
      .update(scriptureReferences)
      .set(tombstone(scriptureReferences.version))
      .where(and(eq(scriptureReferences.id, id), isNull(scriptureReferences.deletedAt)))
      .run();
    if (result.changes > 0) enqueueChange(tx, 'scripture_reference', id, 'delete');
  });
}

/** Detach every passage of a source (used when the source is deleted). Call inside a transaction. */
export function detachAllScriptureReferencesFor(db: AppDatabase, sourceType: ReferenceSourceType, sourceId: string): void {
  const rows = db
    .select({ id: scriptureReferences.id })
    .from(scriptureReferences)
    .where(liveForSource(sourceType, sourceId))
    .all();
  for (const row of rows) {
    db.update(scriptureReferences).set(tombstone(scriptureReferences.version)).where(eq(scriptureReferences.id, row.id)).run();
    enqueueChange(db, 'scripture_reference', row.id, 'delete');
  }
}

export function listScriptureReferences(
  db: AppDatabase,
  sourceType: ReferenceSourceType,
  sourceId: string,
): ScriptureReference[] {
  return db
    .select()
    .from(scriptureReferences)
    .where(liveForSource(sourceType, sourceId))
    .orderBy(asc(scriptureReferences.startVerseId), asc(scriptureReferences.endVerseId))
    .all();
}

export function listScriptureReferencesForSources(
  db: AppDatabase,
  sourceType: ReferenceSourceType,
  sourceIds: readonly string[],
): Map<string, ScriptureReference[]> {
  if (sourceIds.length === 0) return new Map();
  const rows = db
    .select()
    .from(scriptureReferences)
    .where(
      and(
        eq(scriptureReferences.sourceType, sourceType),
        inArray(scriptureReferences.sourceId, [...sourceIds]),
        isNull(scriptureReferences.deletedAt),
      ),
    )
    .orderBy(asc(scriptureReferences.startVerseId))
    .all();
  const grouped = new Map<string, ScriptureReference[]>();
  for (const row of rows) grouped.set(row.sourceId, [...(grouped.get(row.sourceId) ?? []), row]);
  return grouped;
}
