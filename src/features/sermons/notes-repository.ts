/** One main notes document per sermon (Markdown-lite, may contain `[mm:ss]` timestamps). */
import { and, asc, eq, isNull } from 'drizzle-orm';

import { enqueueChange, touch } from '@/db/mutations';
import { sermonNotes } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';

import type { SermonNoteRow } from './types';

export function getSermonNote(db: AppDatabase, sermonId: string): SermonNoteRow | null {
  return (
    db
      .select()
      .from(sermonNotes)
      .where(and(eq(sermonNotes.sermonId, sermonId), isNull(sermonNotes.deletedAt)))
      .orderBy(asc(sermonNotes.sortOrder), asc(sermonNotes.createdAt))
      .get() ?? null
  );
}

/** Create or update the sermon's main note. Unchanged content is not written again. */
export function saveSermonNote(db: AppDatabase, sermonId: string, content: string): SermonNoteRow {
  const existing = getSermonNote(db, sermonId);
  if (existing && existing.content === content) return existing;
  const id = existing?.id ?? newId();
  return db.transaction((tx) => {
    if (existing) {
      tx.update(sermonNotes)
        .set({ content, ...touch(sermonNotes.version) })
        .where(eq(sermonNotes.id, id))
        .run();
    } else {
      tx.insert(sermonNotes).values({ id, sermonId, content, sortOrder: 0 }).run();
    }
    enqueueChange(tx, 'sermon_note', id, 'upsert');
    const saved = tx.select().from(sermonNotes).where(eq(sermonNotes.id, id)).get();
    if (!saved) throw new Error('Notes could not be saved');
    return saved;
  });
}
