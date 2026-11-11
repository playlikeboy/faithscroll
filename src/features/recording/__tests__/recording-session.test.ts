import { createTestDb } from '@/db/testing/create-test-db';
import { createRecordingPart, getRecording, listRecordings, updateRecording } from '@/features/sermons/recordings-repository';
import { createSermon } from '@/features/sermons/sermons-repository';

import { isRecordingActive } from '../active-recordings';
import {
  RecordingSession,
  type PartFileInfo,
  type RecorderPort,
  type RecorderStatusSnapshot,
  type RecordingFilesPort,
} from '../recording-session';

class FakeRecorder implements RecorderPort {
  prepared: string | null = null;
  recording = false;
  duration = 0;
  failPrepare = false;
  prepareCalls: string[] = [];
  stopCalls = 0;

  prepare = async (partId: string) => {
    if (this.failPrepare) throw new Error('microphone busy');
    this.prepared = partId;
    this.duration = 0;
    this.prepareCalls.push(partId);
  };
  record = () => {
    this.recording = true;
  };
  stop = async () => {
    this.recording = false;
    this.stopCalls += 1;
  };
  getStatus = (): RecorderStatusSnapshot => ({
    isRecording: this.recording,
    durationMillis: this.duration,
    metering: -20,
    url: this.prepared ? `file:///docs/ExpoAudio/${this.prepared}.m4a` : null,
  });
}

class FakeFiles implements RecordingFilesPort {
  finalized: { partId: string; url: string | null; inspect: boolean }[] = [];
  inspection: PartFileInfo = { sizeBytes: 1234, playable: true, durationMs: null };
  fileNameFor = (partId: string) => `${partId}.m4a`;
  finalize = async (partId: string, url: string | null, options: { inspect: boolean }): Promise<PartFileInfo> => {
    this.finalized.push({ partId, url, inspect: options.inspect });
    return options.inspect ? this.inspection : { sizeBytes: 1234, playable: null, durationMs: null };
  };
}

const CHECKPOINT_MS = 600_000;

function setup(options: { priorMs?: number; canCheckpoint?: boolean } = {}) {
  const db = createTestDb();
  const sermon = createSermon(db, { title: 'Grace' });
  if (options.priorMs) {
    const earlier = createRecordingPart(db, { sermonId: sermon.id, localFileName: 'earlier.m4a' });
    updateRecording(db, earlier.id, { status: 'saved', durationMs: options.priorMs });
  }
  const recorder = new FakeRecorder();
  const files = new FakeFiles();
  const track = jest.fn();
  let counter = 0;
  const session = new RecordingSession(sermon.id, {
    db,
    recorder,
    files,
    newId: () => `part-${(counter += 1)}`,
    nowIso: () => '2026-11-08T10:00:00.000Z',
    canCheckpoint: () => options.canCheckpoint ?? true,
    track,
    checkpointIntervalMs: CHECKPOINT_MS,
  });
  return { db, sermon, recorder, files, track, session };
}

describe('RecordingSession', () => {
  test('start creates a part before recording and reports elapsed time on the sermon timeline', async () => {
    const { db, recorder, track, session } = setup({ priorMs: 5_000 });

    await expect(session.start()).resolves.toBe(true);
    recorder.duration = 2_000;
    session.tick();

    expect(getRecording(db, 'part-1')).toMatchObject({ status: 'recording', localFileName: 'part-1.m4a' });
    expect(recorder.prepareCalls).toEqual(['part-1']);
    expect(session.getSnapshot()).toMatchObject({ phase: 'recording', elapsedMs: 7_000, currentPartId: 'part-1', metering: -20 });
    expect(isRecordingActive('part-1')).toBe(true);
    expect(track).toHaveBeenCalledWith({ name: 'recording_started' });
  });

  test('pause finalises the part and resume continues in a new part', async () => {
    const { db, sermon, recorder, files, session } = setup();
    await session.start();
    recorder.duration = 30_000;

    await session.pause();

    expect(session.getSnapshot()).toMatchObject({ phase: 'paused', elapsedMs: 30_000, savedPartIds: ['part-1'] });
    expect(getRecording(db, 'part-1')).toMatchObject({ status: 'saved', durationMs: 30_000, sizeBytes: 1234 });
    expect(files.finalized[0]).toEqual({ partId: 'part-1', url: 'file:///docs/ExpoAudio/part-1.m4a', inspect: false });
    expect(isRecordingActive('part-1')).toBe(false);

    await session.resume();
    recorder.duration = 1_000;
    session.tick();

    expect(session.getSnapshot()).toMatchObject({ phase: 'recording', currentPartId: 'part-2', elapsedMs: 31_000 });
    expect(listRecordings(db, sermon.id).map((r) => r.id)).toEqual(['part-1', 'part-2']);
  });

  test('checkpoints into a new part once the interval is reached', async () => {
    const { db, recorder, session } = setup();
    await session.start();
    recorder.duration = CHECKPOINT_MS;

    session.tick();
    session.tick(); // a second tick while the checkpoint is pending must not queue another one
    await session.whenIdle();

    expect(recorder.prepareCalls).toEqual(['part-1', 'part-2']);
    expect(getRecording(db, 'part-1')).toMatchObject({ status: 'saved', durationMs: CHECKPOINT_MS });
    expect(session.getSnapshot()).toMatchObject({ phase: 'recording', currentPartId: 'part-2', elapsedMs: CHECKPOINT_MS });
  });

  test('defers checkpoints while they are not allowed (Android in the background)', async () => {
    const { recorder, session } = setup({ canCheckpoint: false });
    await session.start();
    recorder.duration = CHECKPOINT_MS * 2;

    session.tick();
    await session.whenIdle();

    expect(recorder.prepareCalls).toEqual(['part-1']);
  });

  test('a system interruption saves the audio so far and waits for the user to resume', async () => {
    const { db, recorder, track, session } = setup();
    await session.start();
    recorder.duration = 12_000;
    session.tick();
    recorder.recording = false; // e.g. a phone call paused the recorder

    session.tick();
    expect(session.getSnapshot().phase).toBe('recording'); // one stray tick is tolerated
    session.tick();
    await session.whenIdle();

    expect(session.getSnapshot()).toMatchObject({ phase: 'interrupted', interruption: 'system', elapsedMs: 12_000 });
    expect(getRecording(db, 'part-1')?.status).toBe('saved');
    expect(track).toHaveBeenCalledWith({ name: 'recording_interrupted' });

    await expect(session.resume()).resolves.toBe(true);
    expect(session.getSnapshot().currentPartId).toBe('part-2');
  });

  test('an unexpected native finish inspects the file and marks unplayable audio as failed', async () => {
    const { db, files, session } = setup();
    await session.start();
    files.inspection = { sizeBytes: 10, playable: false, durationMs: null };

    session.handleRecorderEvent({ isFinished: true, hasError: true, url: null, mediaServicesDidReset: true });
    await session.whenIdle();

    expect(files.finalized[0].inspect).toBe(true);
    expect(getRecording(db, 'part-1')?.status).toBe('failed');
    expect(session.getSnapshot()).toMatchObject({ phase: 'interrupted', interruption: 'unexpected', savedPartIds: [] });
  });

  test('ignores late native events for an earlier part', async () => {
    const { recorder, session } = setup();
    await session.start();
    recorder.duration = CHECKPOINT_MS;
    session.tick();
    await session.whenIdle();

    session.handleRecorderEvent({ isFinished: true, hasError: false, url: 'file:///docs/ExpoAudio/part-1.m4a' });
    await session.whenIdle();

    expect(session.getSnapshot()).toMatchObject({ phase: 'recording', currentPartId: 'part-2' });
  });

  test('stop saves the part and tracks the session duration', async () => {
    const { db, recorder, track, session } = setup();
    await session.start();
    recorder.duration = 90_400;

    await expect(session.stop()).resolves.toEqual({ sessionMs: 90_400 });

    expect(session.getSnapshot().phase).toBe('saved');
    expect(getRecording(db, 'part-1')?.status).toBe('saved');
    expect(track).toHaveBeenCalledWith({ name: 'recording_saved', durationSec: 90 });
  });

  test('a failed start removes the empty part, explains the problem and allows a retry', async () => {
    const { db, sermon, recorder, session } = setup();
    recorder.failPrepare = true;

    await expect(session.start()).resolves.toBe(false);

    expect(session.getSnapshot().phase).toBe('error');
    expect(session.getSnapshot().errorMessage).toMatch(/microphone/);
    expect(listRecordings(db, sermon.id)).toEqual([]);

    recorder.failPrepare = false;
    await expect(session.start()).resolves.toBe(true);
  });

  test('bookmarks use the live part, or the end of the last part while paused', async () => {
    const { recorder, session } = setup({ priorMs: 1_000 });
    expect(session.captureBookmark()).toBeNull();
    await session.start();
    recorder.duration = 4_000;

    expect(session.captureBookmark()).toEqual({ recordingId: 'part-1', positionMs: 4_000, elapsedMs: 5_000 });
    expect(session.currentPositionMs()).toBe(5_000);

    await session.pause();
    expect(session.captureBookmark()).toEqual({ recordingId: 'part-1', positionMs: 4_000, elapsedMs: 5_000 });
  });

  test('notifies subscribers with immutable snapshots', async () => {
    const { session } = setup();
    const listener = jest.fn();
    const unsubscribe = session.subscribe(listener);
    const before = session.getSnapshot();

    await session.start();

    expect(listener).toHaveBeenCalled();
    expect(session.getSnapshot()).not.toBe(before);
    expect(before.phase).toBe('idle');
    unsubscribe();
  });
});
