import {
  AiError,
  approximateSegments,
  isOwnedAudioPath,
  isStale,
  parseAskRequest,
  parseJobStatusRequest,
  parseRecapRequest,
  parseStudyRequest,
  parseTranscribeRequest,
  splitIntoChunks,
  toAiError,
  toJobDto,
  totalSeconds,
  usagePeriod,
  type JobRow,
} from '../../../../supabase/functions/_shared/ai-core';

const USER = '11111111-1111-4111-8111-111111111111';
const SERMON = '22222222-2222-4222-8222-222222222222';
const REC_A = '33333333-3333-4333-8333-333333333333';
const REC_B = '44444444-4444-4444-8444-444444444444';

const part = (recordingId: string, extra: Record<string, unknown> = {}) => ({
  recordingId,
  path: `${USER}/${SERMON}/${recordingId}.m4a`,
  durationMs: 600_000,
  mimeType: 'audio/mp4',
  ...extra,
});

function expectInvalid(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AiError);
    expect((error as AiError).code).toBe('invalid_request');
    expect((error as AiError).status).toBe(400);
    return;
  }
  throw new Error('expected invalid_request');
}

describe('isOwnedAudioPath', () => {
  test('accepts only <uid>/<sermonId>/<recordingId>.<audio ext>', () => {
    expect(isOwnedAudioPath(`${USER}/${SERMON}/${REC_A}.m4a`, USER, SERMON, REC_A)).toBe(true);
    expect(isOwnedAudioPath(`${REC_B}/${SERMON}/${REC_A}.m4a`, USER, SERMON, REC_A)).toBe(false);
    expect(isOwnedAudioPath(`${USER}/${SERMON}/${REC_B}.m4a`, USER, SERMON, REC_A)).toBe(false);
    expect(isOwnedAudioPath(`${USER}/../${SERMON}/${REC_A}.m4a`, USER, SERMON, REC_A)).toBe(false);
    expect(isOwnedAudioPath(`${USER}/${SERMON}/${REC_A}.exe`, USER, SERMON, REC_A)).toBe(false);
    expect(isOwnedAudioPath(`/${USER}/${SERMON}/${REC_A}.m4a`, USER, SERMON, REC_A)).toBe(false);
  });
});

describe('parseTranscribeRequest', () => {
  test('accepts the caller’s own parts', () => {
    const input = parseTranscribeRequest({ sermonId: SERMON, parts: [part(REC_A), part(REC_B)], language: 'en' }, USER);
    expect(input.parts).toHaveLength(2);
    expect(input.language).toBe('en');
    expect(totalSeconds(input.parts)).toBe(1200);
  });

  test('rejects other users’ audio, duplicates, bad languages and empty parts', () => {
    expectInvalid(() => parseTranscribeRequest({ sermonId: SERMON, parts: [part(REC_A, { path: `${REC_B}/${SERMON}/${REC_A}.m4a` })] }, USER));
    expectInvalid(() => parseTranscribeRequest({ sermonId: SERMON, parts: [part(REC_A), part(REC_A)] }, USER));
    expectInvalid(() => parseTranscribeRequest({ sermonId: SERMON, parts: [part(REC_A)], language: 'english' }, USER));
    expectInvalid(() => parseTranscribeRequest({ sermonId: SERMON, parts: [] }, USER));
    expectInvalid(() => parseTranscribeRequest({ sermonId: 'nope', parts: [part(REC_A)] }, USER));
    expectInvalid(() => parseTranscribeRequest({ sermonId: SERMON, parts: [part(REC_A, { durationMs: -1 })] }, USER));
    expectInvalid(() => parseTranscribeRequest('x', USER));
  });

  test('rejects more than four hours of audio', () => {
    expectInvalid(() => parseTranscribeRequest({ sermonId: SERMON, parts: [part(REC_A, { durationMs: 5 * 3_600_000 })] }, USER));
  });
});

describe('parseRecapRequest', () => {
  test('accepts transcript content with metadata', () => {
    const input = parseRecapRequest({
      sermonId: SERMON,
      source: 'transcript',
      content: '[00:05] Welcome',
      title: ' Grace ',
      speaker: null,
      mainPassage: '',
      durationSec: 1800,
    });
    expect(input).toEqual({
      sermonId: SERMON,
      source: 'transcript',
      content: '[00:05] Welcome',
      title: 'Grace',
      speaker: null,
      mainPassage: null,
      durationSec: 1800,
    });
  });

  test('rejects empty content, unknown sources and bad durations', () => {
    expectInvalid(() => parseRecapRequest({ sermonId: SERMON, source: 'transcript', content: '  ' }));
    expectInvalid(() => parseRecapRequest({ sermonId: SERMON, source: 'audio', content: 'x' }));
    expectInvalid(() => parseRecapRequest({ sermonId: SERMON, source: 'notes', content: 'x', durationSec: 'long' }));
  });
});

describe('parseStudyRequest / parseAskRequest', () => {
  const passage = { reference: 'John 3:16', translation: 'WEB', passageText: '16 For God so loved the world…' };

  test('study requires a valid mode and well-formed lexical entries', () => {
    expect(parseStudyRequest({ ...passage, mode: 'basic' }).lexicalData).toEqual([]);
    expectInvalid(() => parseStudyRequest({ ...passage, mode: 'expert' }));
    expectInvalid(() => parseStudyRequest({ ...passage, mode: 'advanced', lexicalData: [{ term: 'x', language: 'latin' }] }));
  });

  test('ask keeps only the last turns of history', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i}` }));
    const input = parseAskRequest({ ...passage, question: 'What does this mean?', history });
    expect(input.history).toHaveLength(6);
    expect(input.history[5].content).toBe('turn 9');
    expectInvalid(() => parseAskRequest({ ...passage, question: '' }));
    expectInvalid(() => parseAskRequest({ ...passage, question: 'x', history: [{ role: 'system', content: 'x' }] }));
  });

  test('job status requires a uuid', () => {
    expect(parseJobStatusRequest({ jobId: SERMON })).toEqual({ jobId: SERMON });
    expectInvalid(() => parseJobStatusRequest({ jobId: '1' }));
  });
});

describe('approximate timestamps', () => {
  test('splits text into sentence chunks under the limit', () => {
    const chunks = splitIntoChunks('One. Two! Three? ' + 'word '.repeat(100), 120);
    expect(chunks.every((chunk) => chunk.length <= 120)).toBe(true);
    expect(chunks[0]).toBe('One. Two! Three?');
  });

  test('spreads chunks proportionally across the part duration', () => {
    const segments = approximateSegments('First sentence here. Second.', 10_000);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ start: 0, end: 10, text: 'First sentence here. Second.' });
    expect(approximateSegments('   ', 10_000)).toEqual([]);

    const long = approximateSegments(`${'a'.repeat(200)}. ${'b'.repeat(200)}.`, 100_000);
    expect(long).toHaveLength(2);
    expect(long[0].start).toBe(0);
    expect(long[1].end).toBe(100);
    expect(long[0].end).toBeCloseTo(long[1].start);
  });
});

describe('jobs', () => {
  const row: JobRow = {
    id: 'job',
    user_id: USER,
    job_type: 'transcribe',
    status: 'processing',
    sermon_id: SERMON,
    input: { parts: [{}, {}] },
    result: { parts: [{ text: 'x' }, null] },
    provider: 'openai',
    model: 'whisper-1',
    error_code: null,
    attempts: 1,
    locked_at: '2026-11-11T10:00:00.000Z',
    updated_at: '2026-11-11T10:00:00.000Z',
  };

  test('toJobDto hides partial results and reports progress', () => {
    expect(toJobDto(row)).toEqual({
      id: 'job',
      type: 'transcribe',
      status: 'processing',
      result: null,
      errorCode: null,
      progress: { done: 1, total: 2 },
      provider: 'openai',
      model: 'whisper-1',
      updatedAt: row.updated_at,
    });
    expect(toJobDto({ ...row, status: 'failed', error_code: null }).errorCode).toBe('server');
    expect(toJobDto({ ...row, job_type: 'recap', status: 'completed' }).progress).toBeNull();
  });

  test('isStale detects silent workers', () => {
    expect(isStale(row, new Date('2026-11-11T10:02:00.000Z'))).toBe(false);
    expect(isStale(row, new Date('2026-11-11T10:04:00.000Z'))).toBe(true);
    expect(isStale({ ...row, locked_at: null }, new Date('2026-11-11T10:00:01.000Z'))).toBe(true);
    expect(isStale({ ...row, status: 'queued' }, new Date('2026-11-12T00:00:00.000Z'))).toBe(false);
  });

  test('usagePeriod is the first of the UTC month', () => {
    expect(usagePeriod(new Date('2026-11-30T23:59:59.000Z'))).toBe('2026-11-01');
    expect(usagePeriod(new Date('2027-01-01T00:00:00.000Z'))).toBe('2027-01-01');
  });
});

describe('toAiError', () => {
  test('maps provider errors by code and timeouts', () => {
    expect(toAiError(Object.assign(new Error('x'), { code: 'refused' })).code).toBe('refused');
    expect(toAiError(Object.assign(new Error('x'), { name: 'TimeoutError' })).code).toBe('timeout');
    expect(toAiError(new Error('boom')).code).toBe('server');
    expect(toAiError(new AiError('quota_exceeded')).status).toBe(402);
  });
});
