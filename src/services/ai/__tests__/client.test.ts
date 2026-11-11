import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { getAiJob, startTranscription } from '../api';
import { getAccessToken, invokeAiFunction } from '../client';
import { AiServiceError, fromServerCode, isRetryable, needsPaywall, toAiServiceError } from '../errors';
import { nextPoll, pollInterval } from '../use-ai-job';
import { getSupabase } from '@/services/supabase/client';

jest.mock('@/services/supabase/client', () => ({ getSupabase: jest.fn() }));

const invoke = jest.fn();
const getSession = jest.fn();

function signedIn() {
  getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } }, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSupabase).mockReturnValue({ functions: { invoke }, auth: { getSession } } as never);
  signedIn();
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as AiServiceError).code;
  }
  return 'resolved';
}

const httpError = (status: number, body: unknown) =>
  new FunctionsHttpError({ status, json: async () => body } as unknown as Response);

describe('invokeAiFunction', () => {
  const schema = z.object({ jobId: z.string() });

  test('returns validated data from the envelope', async () => {
    invoke.mockResolvedValue({ data: { data: { jobId: 'j1' } }, error: null });
    await expect(invokeAiFunction('ai-recap', { a: 1 }, schema)).resolves.toEqual({ jobId: 'j1' });
    expect(invoke).toHaveBeenCalledWith('ai-recap', { body: { a: 1 }, timeout: 30_000 });
  });

  test('reports not_configured and signed_out before calling the server', async () => {
    jest.mocked(getSupabase).mockReturnValueOnce(null);
    await expect(codeOf(invokeAiFunction('ai-recap', {}, schema))).resolves.toBe('not_configured');
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(codeOf(invokeAiFunction('ai-recap', {}, schema))).resolves.toBe('signed_out');
    expect(invoke).not.toHaveBeenCalled();
  });

  test('maps server error codes, HTTP statuses and network failures', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: httpError(402, { error: { code: 'quota_exceeded' } }) });
    await expect(codeOf(invokeAiFunction('ai-recap', {}, schema))).resolves.toBe('quota_exceeded');

    invoke.mockResolvedValueOnce({ data: null, error: httpError(403, 'not json') });
    await expect(codeOf(invokeAiFunction('ai-study', {}, schema))).resolves.toBe('plus_required');

    invoke.mockResolvedValueOnce({ data: null, error: new FunctionsFetchError({}) });
    await expect(codeOf(invokeAiFunction('ai-recap', {}, schema))).resolves.toBe('offline');

    invoke.mockRejectedValueOnce(Object.assign(new Error('t'), { name: 'TimeoutError' }));
    await expect(codeOf(invokeAiFunction('ai-recap', {}, schema))).resolves.toBe('timeout');
  });

  test('rejects responses that do not match the schema', async () => {
    invoke.mockResolvedValueOnce({ data: { data: { nope: true } }, error: null });
    await expect(codeOf(invokeAiFunction('ai-recap', {}, schema))).resolves.toBe('invalid_output');
    invoke.mockResolvedValueOnce({ data: 'plain', error: null });
    await expect(codeOf(invokeAiFunction('ai-recap', {}, schema))).resolves.toBe('invalid_output');
  });
});

describe('api', () => {
  test('startTranscription and getAiJob call the right functions', async () => {
    invoke.mockResolvedValueOnce({ data: { data: { jobId: 'j', status: 'queued' } }, error: null });
    await expect(startTranscription({ sermonId: 's', parts: [], language: null })).resolves.toEqual({ jobId: 'j', status: 'queued' });
    expect(invoke.mock.calls[0][0]).toBe('ai-transcribe');

    const job = { id: 'j', type: 'recap', status: 'processing', result: null, errorCode: null, progress: null, provider: 'openai', model: 'm', updatedAt: 'now' };
    invoke.mockResolvedValueOnce({ data: { data: job }, error: null });
    await expect(getAiJob('j')).resolves.toEqual(job);
    expect(invoke.mock.calls[1]).toEqual(['ai-job-status', { body: { jobId: 'j' }, timeout: 30_000 }]);
  });

  test('getAccessToken returns the session token', async () => {
    await expect(getAccessToken()).resolves.toBe('jwt');
  });
});

describe('errors', () => {
  test('server codes map to client codes', () => {
    expect(fromServerCode('provider_error')).toBe('server');
    expect(fromServerCode('output_truncated')).toBe('invalid_output');
    expect(fromServerCode('audio_missing')).toBe('audio_missing');
    expect(fromServerCode(null, 429)).toBe('rate_limited');
    expect(fromServerCode('weird', 500)).toBe('server');
  });

  test('paywall and retry classification', () => {
    expect(needsPaywall('quota_exceeded')).toBe(true);
    expect(needsPaywall('offline')).toBe(false);
    expect(isRetryable('offline')).toBe(true);
    expect(isRetryable('signed_out')).toBe(false);
    expect(toAiServiceError(new Error('x')).code).toBe('server');
    expect(new AiServiceError('offline').message).toMatch(/offline/);
  });
});

describe('polling policy', () => {
  const job = (status: 'processing' | 'completed' | 'failed') => ({
    id: 'j',
    type: 'transcribe' as const,
    status,
    result: null,
    errorCode: null,
    progress: null,
    provider: null,
    model: null,
    updatedAt: '',
  });

  test('backs off and stops on terminal states or permanent errors', () => {
    expect(pollInterval(0)).toBe(3_000);
    expect(pollInterval(20)).toBe(6_000);
    expect(pollInterval(100)).toBe(10_000);
    expect(nextPoll(job('processing'), null, 0)).toBe(3_000);
    expect(nextPoll(job('completed'), null, 3)).toBe(false);
    expect(nextPoll(job('failed'), null, 3)).toBe(false);
    expect(nextPoll(undefined, new AiServiceError('offline'), 0)).toBe(15_000);
    expect(nextPoll(undefined, new AiServiceError('signed_out'), 0)).toBe(false);
  });
});
