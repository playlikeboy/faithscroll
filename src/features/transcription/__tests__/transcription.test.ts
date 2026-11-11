import { and, eq } from 'drizzle-orm';

import {
  applyTranscriptionJob,
  deleteSermonCloudAudio,
  eligibleRecordings,
  refreshDetectedReferences,
  resolvePartFiles,
  uploadAndStartTranscription,
} from '../actions';
import { areTimestampsApproximate } from '../approximate-flags';
import { summarizeReferences } from '../detect-references';
import {
  beginTranscript,
  deleteTranscript,
  getLatestTranscript,
  listSegments,
  listTranscriptReferences,
  markTranscriptFailed,
  updateSegmentText,
} from '../repository';
import { outbox, scriptureReferences, sermonRecordings, sermons, transcripts } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import type { RecordingRow } from '@/features/sermons/types';
import type { AiJob } from '@/services/ai/contracts';

jest.mock('@/features/recording/recording-files', () => ({ locateRecordingFile: jest.fn() }));
jest.mock('@/services/ai/api', () => ({ startTranscription: jest.fn() }));
jest.mock('@/services/upload/upload-recording', () => ({ uploadRecordingFile: jest.fn(), deleteCloudObjects: jest.fn() }));
jest.mock('@/features/bible/repository', () => ({
  // Every parsed single-chapter range "exists" in this fake Bible.
  getVerses: jest.fn(async (range: { start: { bookId: number; chapter: number; verse: number }; end: { verse: number } }) => {
    const verses = [];
    for (let verse = range.start.verse; verse <= range.end.verse; verse += 1) {
      verses.push({ id: range.start.bookId * 1_000_000 + range.start.chapter * 1_000 + verse });
    }
    return verses;
  }),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const SERMON = '22222222-2222-4222-8222-222222222222';
const PART_A = '33333333-3333-4333-8333-333333333333';
const PART_B = '44444444-4444-4444-8444-444444444444';

function setup(): { db: AppDatabase; recordings: RecordingRow[] } {
  const db = createTestDb();
  db.insert(sermons).values({ id: SERMON, title: 'The Power of Forgiveness' }).run();
  db.insert(sermonRecordings)
    .values([
      { id: PART_A, sermonId: SERMON, localFileName: `${PART_A}.m4a`, durationMs: 60_000, sizeBytes: 1_000, status: 'saved', startedAt: '2026-11-08T10:00:00Z' },
      { id: PART_B, sermonId: SERMON, localFileName: `${PART_B}.m4a`, durationMs: 30_000, sizeBytes: 500, status: 'saved', startedAt: '2026-11-08T10:01:00Z' },
    ])
    .run();
  return { db, recordings: db.select().from(sermonRecordings).orderBy(sermonRecordings.startedAt).all() };
}

function recording(db: AppDatabase, id: string): RecordingRow {
  return db.select().from(sermonRecordings).where(eq(sermonRecordings.id, id)).get() as RecordingRow;
}

const completedJob = (result: unknown): AiJob => ({
  id: 'job-1',
  type: 'transcribe',
  status: 'completed',
  result,
  errorCode: null,
  progress: { done: 2, total: 2 },
  provider: 'openai',
  model: 'whisper-1',
  updatedAt: '2026-11-08T11:00:00Z',
});

const jobResult = {
  parts: [
    {
      recordingId: PART_A,
      language: 'en',
      text: 'Turn with me to Romans 8:28. All things work together.',
      segments: [
        { start: 0, end: 5, text: 'Turn with me to Romans 8:28.' },
        { start: 5, end: 9, text: 'All things work together.' },
      ],
      approximate: false,
    },
    { recordingId: PART_B, language: 'en', text: 'Let us pray.', segments: [{ start: 2, end: 4, text: 'Let us pray.' }], approximate: false },
  ],
};

describe('transcript lifecycle', () => {
  test('beginTranscript creates an uploading transcript and reuses an unfinished one', () => {
    const { db } = setup();
    const first = beginTranscript(db, SERMON, null);
    expect(first.status).toBe('uploading');
    markTranscriptFailed(db, first.id, 'offline');

    const again = beginTranscript(db, SERMON, PART_A);
    expect(again.id).toBe(first.id);
    expect(getLatestTranscript(db, SERMON)).toMatchObject({ status: 'uploading', errorCode: null, recordingId: PART_A });
    expect(db.select().from(outbox).where(eq(outbox.entityType, 'transcript')).all().length).toBeGreaterThanOrEqual(3);
  });

  test('uploads parts not yet in the cloud, then starts the job and marks the transcript processing', async () => {
    const { db, recordings } = setup();
    db.update(sermonRecordings).set({ cloudStatus: 'uploaded', cloudPath: `${USER}/${SERMON}/${PART_B}.m4a` }).where(eq(sermonRecordings.id, PART_B)).run();
    const parts = resolvePartFiles(
      eligibleRecordings(db.select().from(sermonRecordings).orderBy(sermonRecordings.startedAt).all()),
      (name) => ({ uri: `file:///docs/recordings/${name}`, size: 2_000 }),
    );
    const transcript = beginTranscript(db, SERMON, null);
    const upload = jest.fn(async (input: { onProgress?: (sent: number, total: number) => void }) => input.onProgress?.(1_000, 2_000));
    const start = jest.fn(async () => ({ jobId: 'job-1', status: 'queued' as const }));
    const onProgress = jest.fn();

    const jobId = await uploadAndStartTranscription({ db, sermonId: SERMON, userId: USER, transcriptId: transcript.id, parts, upload, start, onProgress });

    expect(jobId).toBe('job-1');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatchObject({ fileUri: `file:///docs/recordings/${PART_A}.m4a`, objectPath: `${USER}/${SERMON}/${PART_A}.m4a`, sizeBytes: 2_000 });
    expect(onProgress).toHaveBeenCalledWith({ partIndex: 0, partCount: 1, fraction: 0.5 });
    expect(start).toHaveBeenCalledWith({
      sermonId: SERMON,
      language: null,
      parts: [
        { recordingId: PART_A, path: `${USER}/${SERMON}/${PART_A}.m4a`, durationMs: 60_000, mimeType: 'audio/mp4' },
        { recordingId: PART_B, path: `${USER}/${SERMON}/${PART_B}.m4a`, durationMs: 30_000, mimeType: 'audio/mp4' },
      ],
    });
    expect(recording(db, PART_A)).toMatchObject({ cloudStatus: 'uploaded', cloudPath: `${USER}/${SERMON}/${PART_A}.m4a` });
    expect(getLatestTranscript(db, SERMON)).toMatchObject({ status: 'processing', remoteJobId: 'job-1' });
    expect(recordings).toHaveLength(2);
  });

  test('marks a part upload_failed when its upload fails', async () => {
    const { db, recordings } = setup();
    const parts = resolvePartFiles(recordings, (name) => ({ uri: `file:///${name}`, size: 10 }));
    const transcript = beginTranscript(db, SERMON, null);
    const upload = jest.fn(async () => Promise.reject(Object.assign(new Error('x'), { code: 'offline' })));

    await expect(
      uploadAndStartTranscription({ db, sermonId: SERMON, userId: USER, transcriptId: transcript.id, parts, upload, start: jest.fn() }),
    ).rejects.toMatchObject({ code: 'offline' });
    expect(recording(db, PART_A).cloudStatus).toBe('upload_failed');
  });

  test('resolvePartFiles reports missing and oversized files before uploading', () => {
    const { recordings } = setup();
    expect(() => resolvePartFiles(recordings, () => null)).toThrow(expect.objectContaining({ code: 'file_missing' }));
    expect(() => resolvePartFiles(recordings, () => ({ uri: 'file:///x', size: 30 * 1024 * 1024 }))).toThrow(
      expect.objectContaining({ code: 'audio_too_large' }),
    );
  });
});

describe('applyTranscriptionJob', () => {
  test('merges parts on the sermon timeline, saves segments and detected Scripture with positions', async () => {
    const { db, recordings } = setup();
    const transcript = beginTranscript(db, SERMON, null);

    const outcome = await applyTranscriptionJob({ db, transcriptId: transcript.id, job: completedJob(jobResult), recordings });

    expect(outcome).toEqual({ status: 'completed', durationSec: 90, segmentCount: 3 });
    expect(listSegments(db, transcript.id).map((s) => [s.startMs, s.endMs, s.text])).toEqual([
      [0, 5_000, 'Turn with me to Romans 8:28.'],
      [5_000, 9_000, 'All things work together.'],
      [62_000, 64_000, 'Let us pray.'],
    ]);
    expect(getLatestTranscript(db, SERMON)).toMatchObject({ status: 'completed', language: 'en' });
    const references = listTranscriptReferences(db, transcript.id);
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({ startVerseId: 45008028, endVerseId: 45008028, positionMs: 0, origin: 'detected', sourceType: 'transcript' });
    expect(references[0].referenceText).toMatch(/Romans 8:28/);
    await expect(areTimestampsApproximate(transcript.id)).resolves.toBe(false);
  });

  test('records approximate timestamps', async () => {
    const { db, recordings } = setup();
    const transcript = beginTranscript(db, SERMON, null);
    const approximate = { parts: jobResult.parts.map((part) => ({ ...part, approximate: true })) };
    await applyTranscriptionJob({ db, transcriptId: transcript.id, job: completedJob(approximate), recordings });
    await expect(areTimestampsApproximate(transcript.id)).resolves.toBe(true);
  });

  test('a missing cloud copy resets parts to local so a retry re-uploads', async () => {
    const { db, recordings } = setup();
    const transcript = beginTranscript(db, SERMON, null);
    const failed: AiJob = { ...completedJob(null), status: 'failed', errorCode: 'audio_missing' };

    await expect(applyTranscriptionJob({ db, transcriptId: transcript.id, job: failed, recordings })).resolves.toEqual({
      status: 'failed',
      errorCode: 'audio_missing',
    });
    expect(recording(db, PART_A).cloudStatus).toBe('local');
    expect(getLatestTranscript(db, SERMON)).toMatchObject({ status: 'failed', errorCode: 'audio_missing' });
  });

  test('rejects malformed results', async () => {
    const { db, recordings } = setup();
    const transcript = beginTranscript(db, SERMON, null);
    const outcome = await applyTranscriptionJob({ db, transcriptId: transcript.id, job: completedJob({ parts: 'nope' }), recordings });
    expect(outcome).toEqual({ status: 'failed', errorCode: 'invalid_output' });
  });
});

describe('editing and deleting', () => {
  async function completed() {
    const context = setup();
    const transcript = beginTranscript(context.db, SERMON, null);
    await applyTranscriptionJob({ db: context.db, transcriptId: transcript.id, job: completedJob(jobResult), recordings: context.recordings });
    return { ...context, transcriptId: transcript.id };
  }

  test('correcting a segment rebuilds the text and refreshes detected references', async () => {
    const { db, transcriptId } = await completed();
    const segment = listSegments(db, transcriptId)[1];

    updateSegmentText(db, transcriptId, segment.id, 'All things work together, as John 3:16 says.');
    await refreshDetectedReferences(db, transcriptId);

    const row = db.select().from(transcripts).where(eq(transcripts.id, transcriptId)).get();
    expect(row?.text).toContain('as John 3:16 says.');
    expect(row?.editedAt).not.toBeNull();
    expect(listTranscriptReferences(db, transcriptId).map((r) => r.startVerseId)).toEqual([45008028, 43003016]);
    expect(() => updateSegmentText(db, transcriptId, segment.id, '   ')).toThrow();
  });

  test('deleting a transcript tombstones it and its detected references', async () => {
    const { db, transcriptId } = await completed();
    deleteTranscript(db, transcriptId);

    expect(getLatestTranscript(db, SERMON)).toBeNull();
    expect(listSegments(db, transcriptId)).toEqual([]);
    const live = db
      .select()
      .from(scriptureReferences)
      .where(and(eq(scriptureReferences.sourceId, transcriptId)))
      .all()
      .filter((r) => r.deletedAt === null);
    expect(live).toEqual([]);
  });

  test('deleting the cloud audio removes every uploaded part and marks it cloud_deleted', async () => {
    const { db } = setup();
    db.update(sermonRecordings).set({ cloudStatus: 'uploaded', cloudPath: 'u/s/a.m4a' }).where(eq(sermonRecordings.id, PART_A)).run();
    const remove = jest.fn(async () => undefined);

    const count = await deleteSermonCloudAudio(db, db.select().from(sermonRecordings).all(), remove);

    expect(count).toBe(1);
    expect(remove).toHaveBeenCalledWith(['u/s/a.m4a']);
    expect(recording(db, PART_A)).toMatchObject({ cloudStatus: 'cloud_deleted', cloudPath: null });
  });
});

describe('summarizeReferences', () => {
  test('groups mentions of the same passage into one chip with every position', () => {
    expect(
      summarizeReferences([
        { referenceText: 'John 3:16', startVerseId: 1, endVerseId: 1, positionMs: 9_000 },
        { referenceText: 'Romans 8:28', startVerseId: 2, endVerseId: 2, positionMs: 1_000 },
        { referenceText: 'John 3:16', startVerseId: 1, endVerseId: 1, positionMs: 3_000 },
      ]),
    ).toEqual([
      { referenceText: 'Romans 8:28', startVerseId: 2, endVerseId: 2, positionsMs: [1_000] },
      { referenceText: 'John 3:16', startVerseId: 1, endVerseId: 1, positionsMs: [3_000, 9_000] },
    ]);
  });
});
