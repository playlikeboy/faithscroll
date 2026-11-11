import { createTestDb } from '@/db/testing/create-test-db';
import { createRecordingPart, getRecording, updateRecording } from '@/features/sermons/recordings-repository';
import { createSermon } from '@/features/sermons/sermons-repository';

import { markRecordingActive, markRecordingInactive } from '../active-recordings';
import { recoverInterruptedRecordings, type RecoveryInspector } from '../recover-recordings';

// The default file inspector touches expo-file-system (native); tests inject their own.
jest.mock('../recording-files', () => ({ inspectStoredRecording: jest.fn(() => null) }));

function seed() {
  const db = createTestDb();
  const sermon = createSermon(db, { title: 'Grace' });
  const part = (id: string) => createRecordingPart(db, { sermonId: sermon.id, id, localFileName: `${id}.m4a` });
  return { db, sermon, part };
}

const inspector = (results: Record<string, ReturnType<RecoveryInspector>>): RecoveryInspector => (fileName) => results[fileName] ?? null;

describe('recoverInterruptedRecordings', () => {
  test('marks playable unfinished parts as interrupted with the duration from the file', () => {
    const { db, sermon, part } = seed();
    part('ok');
    const track = jest.fn();

    const result = recoverInterruptedRecordings(db, {
      inspect: inspector({ 'ok.m4a': { sizeBytes: 2048, inspection: { playable: true, durationMs: 61_000 } } }),
      track,
    });

    expect(result).toEqual({ recovered: 1, failed: 0, sermonIds: [sermon.id] });
    expect(getRecording(db, 'ok')).toMatchObject({ status: 'interrupted', durationMs: 61_000, sizeBytes: 2048 });
    expect(getRecording(db, 'ok')?.endedAt).not.toBeNull();
    expect(track).toHaveBeenCalledWith({ name: 'recording_interrupted' });
  });

  test('marks missing or unfinalised files as failed', () => {
    const { db, part } = seed();
    part('missing');
    part('broken');
    const paused = part('paused');
    updateRecording(db, paused.id, { status: 'paused' });

    const result = recoverInterruptedRecordings(db, {
      inspect: inspector({
        'broken.m4a': { sizeBytes: 900_000, inspection: { playable: false, durationMs: null } },
        'paused.m4a': { sizeBytes: 10, inspection: { playable: false, durationMs: null } },
      }),
      track: jest.fn(),
    });

    expect(result).toMatchObject({ recovered: 0, failed: 3 });
    expect(getRecording(db, 'missing')?.status).toBe('failed');
    expect(getRecording(db, 'broken')).toMatchObject({ status: 'failed', sizeBytes: 900_000 });
    expect(getRecording(db, 'paused')?.status).toBe('failed');
  });

  test('never touches a part that is being recorded right now', () => {
    const { db, part } = seed();
    part('live');
    markRecordingActive('live');

    const result = recoverInterruptedRecordings(db, { inspect: () => null, track: jest.fn() });

    expect(result).toEqual({ recovered: 0, failed: 0, sermonIds: [] });
    expect(getRecording(db, 'live')?.status).toBe('recording');
    markRecordingInactive('live');
  });

  test('treats inspection errors as unrecoverable without throwing', () => {
    const { db, part } = seed();
    part('weird');

    const result = recoverInterruptedRecordings(db, {
      inspect: () => {
        throw new Error('disk error');
      },
      track: jest.fn(),
    });

    expect(result.failed).toBe(1);
    expect(getRecording(db, 'weird')?.status).toBe('failed');
  });

  test('leaves saved parts alone', () => {
    const { db, part } = seed();
    const saved = part('saved');
    updateRecording(db, saved.id, { status: 'saved', durationMs: 5 });

    expect(recoverInterruptedRecordings(db, { inspect: () => null, track: jest.fn() })).toEqual({ recovered: 0, failed: 0, sermonIds: [] });
  });
});
