/**
 * Local persistence for sermon recaps and the "Live It Out" actions created from them.
 * Regenerating keeps the same recap row (and its current content) until the new result arrives.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { actionItems, sermonRecaps } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

import { parseStoredRecap, serializeRecap, type RecapActionItem, type SermonRecap } from './schema';

export type RecapRow = typeof sermonRecaps.$inferSelect;
export type ActionItemRow = typeof actionItems.$inferSelect;

export function getLatestRecap(db: AppDatabase, sermonId: string): RecapRow | null {
  return (
    db
      .select()
      .from(sermonRecaps)
      .where(and(eq(sermonRecaps.sermonId, sermonId), isNull(sermonRecaps.deletedAt)))
      .orderBy(desc(sermonRecaps.createdAt))
      .get() ?? null
  );
}

export function readRecapContent(row: RecapRow | null): SermonRecap | null {
  return parseStoredRecap(row?.contentJson);
}

/** Record that a (re)generation job started. Returns the recap id. */
export function markRecapRequested(
  db: AppDatabase,
  params: { sermonId: string; transcriptId: string | null; remoteJobId: string },
): string {
  const existing = getLatestRecap(db, params.sermonId);
  return db.transaction((tx) => {
    if (existing) {
      tx.update(sermonRecaps)
        .set({ status: 'processing', remoteJobId: params.remoteJobId, transcriptId: params.transcriptId, errorCode: null, ...touch(sermonRecaps.version) })
        .where(eq(sermonRecaps.id, existing.id))
        .run();
      enqueueChange(tx, 'sermon_recap', existing.id);
      return existing.id;
    }
    const id = newId();
    tx.insert(sermonRecaps)
      .values({ id, sermonId: params.sermonId, transcriptId: params.transcriptId, remoteJobId: params.remoteJobId, status: 'processing' })
      .run();
    enqueueChange(tx, 'sermon_recap', id);
    return id;
  });
}

function patchRecap(db: AppDatabase, recapId: string, patch: Partial<typeof sermonRecaps.$inferInsert>): void {
  db.transaction((tx) => {
    tx.update(sermonRecaps).set({ ...patch, ...touch(sermonRecaps.version) }).where(eq(sermonRecaps.id, recapId)).run();
    enqueueChange(tx, 'sermon_recap', recapId);
  });
}

export function saveRecapResult(db: AppDatabase, recapId: string, recap: SermonRecap, meta: { provider: string | null; model: string | null }): void {
  patchRecap(db, recapId, {
    status: 'completed',
    contentJson: serializeRecap(recap),
    provider: meta.provider,
    model: meta.model,
    errorCode: null,
    generatedAt: nowIso(),
    editedAt: null,
  });
}

export function markRecapFailed(db: AppDatabase, recapId: string, errorCode: string): void {
  patchRecap(db, recapId, { status: 'failed', errorCode });
}

/** Save the user's edits to any section. */
export function updateRecapContent(db: AppDatabase, recapId: string, recap: SermonRecap): void {
  patchRecap(db, recapId, { contentJson: serializeRecap(recap), editedAt: nowIso() });
}

export function deleteRecap(db: AppDatabase, recapId: string): void {
  db.transaction((tx) => {
    tx.update(sermonRecaps).set({ ...tombstone(sermonRecaps.version), contentJson: null }).where(eq(sermonRecaps.id, recapId)).run();
    enqueueChange(tx, 'sermon_recap', recapId, 'delete');
  });
}

/** Turn a "Live It Out" suggestion into one of the user's action items. */
export function addActionItemFromRecap(db: AppDatabase, recapId: string, item: RecapActionItem): string {
  const id = newId();
  db.transaction((tx) => {
    tx.insert(actionItems)
      .values({ id, title: item.title, notes: item.description, sourceType: 'sermon_recap', sourceId: recapId })
      .run();
    enqueueChange(tx, 'action_item', id);
  });
  return id;
}

export function listRecapActionItems(db: AppDatabase, recapId: string): ActionItemRow[] {
  return db
    .select()
    .from(actionItems)
    .where(and(eq(actionItems.sourceType, 'sermon_recap'), eq(actionItems.sourceId, recapId), isNull(actionItems.deletedAt)))
    .all();
}
