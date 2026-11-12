/**
 * The sample-content marker: one `sync_state` row whose value records exactly which rows were
 * seeded, so they can be removed precisely and never seeded again.
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { syncState } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';
import { nowIso } from '@/lib/time';

export const SAMPLE_MARKER_KEY = 'seed:sample:v1';

const ids = z.array(z.string()).default([]);

const itemsSchema = z.object({
  journalEntries: ids,
  prayers: ids,
  sermons: ids,
  series: ids,
  actionItems: ids,
  highlights: ids,
  savedVerses: ids,
  verseNotes: ids,
  collections: ids,
  tags: ids,
  readingHistory: ids,
  /** The seeded "continue reading" row; only removed if nobody has read since. */
  readingProgress: z.object({ translationId: z.string(), updatedAt: z.string() }).nullable().default(null),
});

const manifestSchema = z.object({
  version: z.literal(1),
  status: z.enum(['present', 'removed', 'skipped']),
  seededAt: z.string(),
  removedAt: z.string().nullable().default(null),
  items: itemsSchema,
});

export type SampleItems = z.infer<typeof itemsSchema>;
export type SampleManifest = z.infer<typeof manifestSchema>;
export type SampleStatus = SampleManifest['status'];

export function emptySampleItems(): SampleItems {
  return itemsSchema.parse({});
}

export function hasSampleMarker(db: AppDatabase): boolean {
  return db.select({ key: syncState.key }).from(syncState).where(eq(syncState.key, SAMPLE_MARKER_KEY)).get() !== undefined;
}

/** The stored manifest, or null when there is no marker or it can't be read. */
export function readSampleManifest(db: AppDatabase): SampleManifest | null {
  const row = db.select({ value: syncState.value }).from(syncState).where(eq(syncState.key, SAMPLE_MARKER_KEY)).get();
  if (!row) return null;
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(row.value));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through: unreadable marker
  }
  logger.warn('Sample content marker is unreadable');
  return null;
}

export function writeSampleManifest(db: AppDatabase, manifest: SampleManifest): void {
  const value = JSON.stringify(manifest);
  const updatedAt = nowIso();
  db.insert(syncState)
    .values({ key: SAMPLE_MARKER_KEY, value, updatedAt })
    .onConflictDoUpdate({ target: syncState.key, set: { value, updatedAt } })
    .run();
}
