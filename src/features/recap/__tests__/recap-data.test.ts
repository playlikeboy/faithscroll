import { eq } from 'drizzle-orm';

import { applyRecapJob } from '../apply';
import { buildRecapRequest, transcriptToRecapContent } from '../build-input';
import {
  addActionItemFromRecap,
  deleteRecap,
  getLatestRecap,
  listRecapActionItems,
  markRecapRequested,
  readRecapContent,
  updateRecapContent,
} from '../repository';
import { emptyRecap } from '../schema';
import { actionItems, outbox, sermons } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import { recapFixture } from '@/features/study-ai/testing/fixtures';
import type { AiJob } from '@/services/ai/contracts';
import type { ReferenceChecker } from '@/services/ai/validation';

const SERMON = '22222222-2222-4222-8222-222222222222';

function setup() {
  const db = createTestDb();
  db.insert(sermons).values({ id: SERMON, title: 'The Power of Forgiveness' }).run();
  return db;
}

const checker: ReferenceChecker = async (text) =>
  text.startsWith('Matthew 18')
    ? {
        reference: 'Matthew 18:21–22',
        range: { start: { bookId: 40, chapter: 18, verse: 21 }, end: { bookId: 40, chapter: 18, verse: 22 } },
        startVerseId: 40018021,
        endVerseId: 40018022,
      }
    : null;

const job = (overrides: Partial<AiJob>): AiJob => ({
  id: 'job',
  type: 'recap',
  status: 'completed',
  result: { output: recapFixture() },
  errorCode: null,
  progress: null,
  provider: 'openai',
  model: 'text-model',
  updatedAt: '',
  ...overrides,
});

describe('buildRecapRequest', () => {
  const base = { sermonId: SERMON, title: 'Grace', speaker: 'Pastor John', mainPassage: 'Matthew 18:21-35', durationMs: 1_800_000 };

  test('prefers the transcript with [mm:ss] markers', () => {
    const result = buildRecapRequest({
      ...base,
      transcriptId: 't1',
      segments: [
        { startMs: 0, text: 'Welcome.' },
        { startMs: 3_725_000, text: 'Amen.' },
      ],
      notes: 'my notes',
    });
    expect(result).toEqual({
      ok: true,
      transcriptId: 't1',
      request: { ...base, durationMs: undefined, source: 'transcript', content: '[00:00] Welcome.\n[1:02:05] Amen.', durationSec: 1800 },
    });
  });

  test('falls back to notes, and reports when there is nothing to recap', () => {
    const notes = buildRecapRequest({ ...base, durationMs: 0, transcriptId: null, segments: [], notes: '  # Notes\n- forgive  ' });
    expect(notes).toMatchObject({ ok: true, transcriptId: null, request: { source: 'notes', content: '# Notes\n- forgive', durationSec: null } });
    expect(buildRecapRequest({ ...base, transcriptId: null, segments: [], notes: ' ' })).toEqual({ ok: false, reason: 'no_content' });
  });

  test('caps very long transcripts', () => {
    const segments = Array.from({ length: 5_000 }, (_, i) => ({ startMs: i * 1000, text: 'x'.repeat(60) }));
    expect(transcriptToRecapContent(segments).length).toBeLessThanOrEqual(180_000);
  });
});

describe('recap repository + apply', () => {
  test('stores a validated recap, keeps the row on regenerate, and records failures', async () => {
    const db = setup();
    const recapId = markRecapRequested(db, { sermonId: SERMON, transcriptId: null, remoteJobId: 'job' });

    const outcome = await applyRecapJob({ db, recapId, job: job({}), durationSec: 300, checker });
    expect(outcome).toEqual({ status: 'completed', report: { droppedReferences: 0, adjustedTimestamps: 2 } });
    const stored = readRecapContent(getLatestRecap(db, SERMON));
    expect(stored?.scripture_references[0]).toMatchObject({ reference: 'Matthew 18:21–22', startVerseId: 40018021 });
    expect(stored?.main_points[0].timestamps).toEqual([65, 300]);
    expect(getLatestRecap(db, SERMON)).toMatchObject({ status: 'completed', provider: 'openai', model: 'text-model' });

    expect(markRecapRequested(db, { sermonId: SERMON, transcriptId: null, remoteJobId: 'job-2' })).toBe(recapId);
    await applyRecapJob({ db, recapId, job: job({ status: 'failed', errorCode: 'quota_exceeded', result: null }), durationSec: 300 });
    const failed = getLatestRecap(db, SERMON);
    expect(failed).toMatchObject({ status: 'failed', errorCode: 'quota_exceeded' });
    // The previous content survives a failed regeneration.
    expect(readRecapContent(failed)?.summary).toBe(stored?.summary);
  });

  test('rejects malformed output', async () => {
    const db = setup();
    const recapId = markRecapRequested(db, { sermonId: SERMON, transcriptId: null, remoteJobId: 'job' });
    await expect(applyRecapJob({ db, recapId, job: job({ result: { output: { summary: 1 } } }), durationSec: null })).resolves.toEqual({
      status: 'failed',
      errorCode: 'invalid_output',
    });
  });

  test('edits, deletes and creates action items with outbox entries', () => {
    const db = setup();
    const recapId = markRecapRequested(db, { sermonId: SERMON, transcriptId: null, remoteJobId: 'job' });
    updateRecapContent(db, recapId, { ...emptyRecap(), summary: 'Edited' });
    expect(readRecapContent(getLatestRecap(db, SERMON))?.summary).toBe('Edited');
    expect(getLatestRecap(db, SERMON)?.editedAt).not.toBeNull();

    const actionId = addActionItemFromRecap(db, recapId, { title: 'Call my brother', description: null });
    expect(db.select().from(actionItems).where(eq(actionItems.id, actionId)).get()).toMatchObject({
      title: 'Call my brother',
      sourceType: 'sermon_recap',
      sourceId: recapId,
    });
    expect(listRecapActionItems(db, recapId)).toHaveLength(1);
    expect(db.select().from(outbox).where(eq(outbox.entityType, 'action_item')).all()).toHaveLength(1);

    deleteRecap(db, recapId);
    expect(getLatestRecap(db, SERMON)).toBeNull();
  });
});
