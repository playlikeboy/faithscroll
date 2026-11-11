import { and, asc, between, eq, inArray, isNull } from 'drizzle-orm';

import { enqueueChange, tombstone, touch } from '@/db/mutations';
import { HIGHLIGHT_COLOR_VALUES, highlights } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

export type HighlightRow = typeof highlights.$inferSelect;
export type HighlightColorValue = (typeof HIGHLIGHT_COLOR_VALUES)[number];

function assertColor(color: string): asserts color is HighlightColorValue {
  if (!(HIGHLIGHT_COLOR_VALUES as readonly string[]).includes(color)) {
    throw new Error(`Unknown highlight colour: ${color}`);
  }
}

/** Insert or update the single highlight row for a verse (reviving a tombstone if present). */
function upsertHighlight(db: AppDatabase, verseId: number, color: HighlightColorValue): string {
  const existing = db.select().from(highlights).where(eq(highlights.verseId, verseId)).get();
  if (existing) {
    if (existing.deletedAt === null && existing.color === color) return existing.id;
    db.update(highlights)
      .set({ color, deletedAt: null, ...touch(highlights.version) })
      .where(eq(highlights.id, existing.id))
      .run();
    enqueueChange(db, 'highlight', existing.id, 'upsert');
    return existing.id;
  }
  const id = newId();
  db.insert(highlights).values({ id, verseId, color }).run();
  enqueueChange(db, 'highlight', id, 'upsert');
  return id;
}

/** Highlight every verse in `verseIds` with one colour. Returns the highlight ids. */
export function setHighlights(db: AppDatabase, verseIds: readonly number[], color: HighlightColorValue): string[] {
  assertColor(color);
  const unique = [...new Set(verseIds)];
  return db.transaction((tx) => unique.map((verseId) => upsertHighlight(tx, verseId, color)));
}

export function setHighlight(db: AppDatabase, verseId: number, color: HighlightColorValue): string {
  const [id] = setHighlights(db, [verseId], color);
  return id;
}

/** Remove (tombstone) highlights on the given verses. Verses without a highlight are ignored. */
export function removeHighlights(db: AppDatabase, verseIds: readonly number[]): void {
  if (verseIds.length === 0) return;
  db.transaction((tx) => {
    const live = tx
      .select({ id: highlights.id })
      .from(highlights)
      .where(and(inArray(highlights.verseId, [...verseIds]), isNull(highlights.deletedAt)))
      .all();
    for (const { id } of live) {
      tx.update(highlights).set(tombstone(highlights.version)).where(eq(highlights.id, id)).run();
      enqueueChange(tx, 'highlight', id, 'delete');
    }
  });
}

/** Live highlights with verse ids in [startVerseId, endVerseId]. Returns a query (use `.all()` or `useLiveQuery`). */
export function listHighlightsInRange(db: AppDatabase, startVerseId: number, endVerseId: number) {
  return db
    .select()
    .from(highlights)
    .where(and(between(highlights.verseId, startVerseId, endVerseId), isNull(highlights.deletedAt)))
    .orderBy(asc(highlights.verseId));
}

/** Map of verse id → highlight colour for the given verses (live rows only). */
export function getHighlightColors(db: AppDatabase, verseIds: readonly number[]): Map<number, HighlightColorValue> {
  if (verseIds.length === 0) return new Map();
  const rows = db
    .select({ verseId: highlights.verseId, color: highlights.color })
    .from(highlights)
    .where(and(inArray(highlights.verseId, [...verseIds]), isNull(highlights.deletedAt)))
    .all();
  return new Map(rows.map((row) => [row.verseId, row.color]));
}
