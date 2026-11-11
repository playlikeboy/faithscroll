/** Read-only views of AI/derived tables that belong to a sermon (written by the AI and library features). */
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { actionItems, sermonRecaps, transcripts } from '@/db/schema';
import type { AppDatabase } from '@/db/types';

import type { ActionItemRow, AiStatus, SermonAiStatus } from './types';

function latestStatus(db: AppDatabase, table: typeof transcripts | typeof sermonRecaps, sermonId: string): AiStatus | null {
  const row = db
    .select({ status: table.status })
    .from(table)
    .where(and(eq(table.sermonId, sermonId), isNull(table.deletedAt)))
    .orderBy(desc(table.updatedAt))
    .get();
  return row?.status ?? null;
}

/** Status of the most recent transcript and recap, for badges and entry rows. */
export function getSermonAiStatus(db: AppDatabase, sermonId: string): SermonAiStatus {
  return {
    transcriptStatus: latestStatus(db, transcripts, sermonId),
    recapStatus: latestStatus(db, sermonRecaps, sermonId),
  };
}

/** Action items created from this sermon or from one of its recaps. Open items first. */
export function listSermonActionItems(db: AppDatabase, sermonId: string): ActionItemRow[] {
  const recapIds = db
    .select({ id: sermonRecaps.id })
    .from(sermonRecaps)
    .where(and(eq(sermonRecaps.sermonId, sermonId), isNull(sermonRecaps.deletedAt)))
    .all()
    .map((row) => row.id);

  const fromSermon = and(eq(actionItems.sourceType, 'sermon'), eq(actionItems.sourceId, sermonId));
  const fromRecap = recapIds.length > 0 ? and(eq(actionItems.sourceType, 'sermon_recap'), inArray(actionItems.sourceId, recapIds)) : undefined;

  return db
    .select()
    .from(actionItems)
    .where(and(isNull(actionItems.deletedAt), or(fromSermon, fromRecap)))
    .orderBy(asc(sql`${actionItems.completedAt} is not null`), asc(actionItems.createdAt))
    .all();
}
