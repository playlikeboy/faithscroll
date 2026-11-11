import { eq } from 'drizzle-orm';

import { outbox } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';

import { addBookmark, deleteBookmark, listBookmarks, updateBookmark } from '../bookmarks-repository';
import { getSermonNote, saveSermonNote } from '../notes-repository';
import { createRecordingPart } from '../recordings-repository';
import { createSermon } from '../sermons-repository';

describe('bookmarks repository', () => {
  function seed() {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    const first = createRecordingPart(db, { sermonId: sermon.id, id: 'p1', localFileName: 'p1.m4a', startedAt: '2026-11-08T10:00:00.000Z' });
    const second = createRecordingPart(db, { sermonId: sermon.id, id: 'p2', localFileName: 'p2.m4a', startedAt: '2026-11-08T10:10:00.000Z' });
    return { db, sermon, first, second };
  }

  test('adds a bookmark with an optional note and reference', () => {
    const { db, sermon, first } = seed();

    const bookmark = addBookmark(db, {
      sermonId: sermon.id,
      recordingId: first.id,
      positionMs: 65_000,
      note: '  Forgive seventy times seven ',
      reference: { text: 'Matthew 18:22', startVerseId: 40018022, endVerseId: 40018022 },
    });

    expect(bookmark).toMatchObject({
      positionMs: 65_000,
      note: 'Forgive seventy times seven',
      reference: 'Matthew 18:22',
      startVerseId: 40018022,
      endVerseId: 40018022,
    });
    expect(db.select().from(outbox).where(eq(outbox.entityId, bookmark.id)).all()).toHaveLength(1);
  });

  test('rejects negative positions', () => {
    const { db, sermon, first } = seed();
    expect(() => addBookmark(db, { sermonId: sermon.id, recordingId: first.id, positionMs: -1 })).toThrow();
  });

  test('lists bookmarks by part order, then position', () => {
    const { db, sermon, first, second } = seed();
    addBookmark(db, { sermonId: sermon.id, recordingId: second.id, positionMs: 1_000, note: 'c' });
    addBookmark(db, { sermonId: sermon.id, recordingId: first.id, positionMs: 9_000, note: 'b' });
    addBookmark(db, { sermonId: sermon.id, recordingId: first.id, positionMs: 2_000, note: 'a' });

    expect(listBookmarks(db, sermon.id).map((b) => b.note)).toEqual(['a', 'b', 'c']);
  });

  test('updates note and reference, and deletes softly', () => {
    const { db, sermon, first } = seed();
    const bookmark = addBookmark(db, { sermonId: sermon.id, recordingId: first.id, positionMs: 1_000 });

    const updated = updateBookmark(db, bookmark.id, {
      note: 'Key point',
      reference: { text: 'Romans 8:28', startVerseId: 45008028, endVerseId: 45008028 },
    });
    expect(updated).toMatchObject({ note: 'Key point', reference: 'Romans 8:28', version: 2 });

    const cleared = updateBookmark(db, bookmark.id, { reference: null, note: '' });
    expect(cleared).toMatchObject({ note: null, reference: null, startVerseId: null, endVerseId: null });

    deleteBookmark(db, bookmark.id);
    expect(listBookmarks(db, sermon.id)).toEqual([]);
  });
});

describe('notes repository', () => {
  test('creates the main note on first save and updates it afterwards', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    expect(getSermonNote(db, sermon.id)).toBeNull();

    const created = saveSermonNote(db, sermon.id, '# Notes');
    const updated = saveSermonNote(db, sermon.id, '# Notes\n- [01:05] forgiveness');

    expect(updated.id).toBe(created.id);
    expect(updated.content).toBe('# Notes\n- [01:05] forgiveness');
    expect(updated.version).toBe(2);
    expect(getSermonNote(db, sermon.id)?.id).toBe(created.id);
    expect(db.select().from(outbox).where(eq(outbox.entityId, created.id)).all()).toHaveLength(2);
  });

  test('skips writes when the content is unchanged', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    const created = saveSermonNote(db, sermon.id, 'Same');

    const again = saveSermonNote(db, sermon.id, 'Same');

    expect(again.version).toBe(created.version);
    expect(db.select().from(outbox).where(eq(outbox.entityId, created.id)).all()).toHaveLength(1);
  });
});
