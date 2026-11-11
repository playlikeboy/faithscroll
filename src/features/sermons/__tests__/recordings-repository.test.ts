import { eq } from 'drizzle-orm';

import { outbox, sermonBookmarks } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';

import { addBookmark } from '../bookmarks-repository';
import {
  createRecordingPart,
  deleteRecording,
  getRecording,
  listRecordings,
  listUnfinishedRecordings,
  playableDurationMs,
  renameRecording,
  updateRecording,
} from '../recordings-repository';
import { createSermon } from '../sermons-repository';

describe('recordings repository', () => {
  test('creates a part in the recording state and enqueues it', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });

    const part = createRecordingPart(db, { sermonId: sermon.id, id: 'part-1', localFileName: 'part-1.m4a' });

    expect(part).toMatchObject({
      id: 'part-1',
      sermonId: sermon.id,
      status: 'recording',
      localFileName: 'part-1.m4a',
      mimeType: 'audio/mp4',
      durationMs: 0,
    });
    expect(part.startedAt).not.toBeNull();
    expect(db.select().from(outbox).where(eq(outbox.entityId, 'part-1')).all()).toHaveLength(1);
  });

  test('updates status, duration and size', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    const part = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'a.m4a' });

    const saved = updateRecording(db, part.id, { status: 'saved', durationMs: 600_000, sizeBytes: 2_400_000, endedAt: 'now' });

    expect(saved).toMatchObject({ status: 'saved', durationMs: 600_000, sizeBytes: 2_400_000, endedAt: 'now', version: 2 });
  });

  test('renames and clears custom titles', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    const part = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'a.m4a' });

    expect(renameRecording(db, part.id, ' Worship ')?.title).toBe('Worship');
    expect(renameRecording(db, part.id, '  ')?.title).toBeNull();
  });

  test('soft-deletes a part with its bookmarks and returns its file name', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    const part = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'a.m4a' });
    addBookmark(db, { sermonId: sermon.id, recordingId: part.id, positionMs: 1000 });

    expect(deleteRecording(db, part.id)).toEqual({ localFileName: 'a.m4a' });
    expect(getRecording(db, part.id)).toBeNull();
    expect(listRecordings(db, sermon.id)).toEqual([]);
    expect(db.select().from(sermonBookmarks).all()[0].deletedAt).not.toBeNull();
    expect(deleteRecording(db, part.id)).toEqual({ localFileName: null });
  });

  test('lists parts in recording order', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    createRecordingPart(db, { sermonId: sermon.id, id: 'b', localFileName: 'b.m4a', startedAt: '2026-11-08T10:10:00.000Z' });
    createRecordingPart(db, { sermonId: sermon.id, id: 'a', localFileName: 'a.m4a', startedAt: '2026-11-08T10:00:00.000Z' });

    expect(listRecordings(db, sermon.id).map((r) => r.id)).toEqual(['a', 'b']);
  });

  test('finds unfinished parts across sermons and sums playable duration', () => {
    const db = createTestDb();
    const sermon = createSermon(db, { title: 'Grace' });
    const live = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'a.m4a' });
    const paused = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'b.m4a' });
    updateRecording(db, paused.id, { status: 'paused', durationMs: 1_000 });
    const saved = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'c.m4a' });
    updateRecording(db, saved.id, { status: 'saved', durationMs: 4_000 });
    const interrupted = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'd.m4a' });
    updateRecording(db, interrupted.id, { status: 'interrupted', durationMs: 2_000 });

    expect(listUnfinishedRecordings(db).map((r) => r.id).sort()).toEqual([live.id, paused.id].sort());
    expect(playableDurationMs(db, sermon.id)).toBe(6_000);
  });
});
