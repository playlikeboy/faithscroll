import {
  createOpenAiProvider,
  extractStructuredOutput,
  parseTranscriptionResponse,
  ProviderError,
  transcriptionFormatFor,
} from '../../../../supabase/functions/_shared/openai';

function fakeResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, body: null } as unknown as Response;
}

const completed = (text: string) => ({
  status: 'completed',
  model: 'gpt-test-2026-10-01',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
});

describe('transcriptionFormatFor', () => {
  test('picks the response format that carries timestamps for each model family', () => {
    expect(transcriptionFormatFor('whisper-1')).toBe('verbose_json');
    expect(transcriptionFormatFor('gpt-4o-transcribe-diarize')).toBe('diarized_json');
    expect(transcriptionFormatFor('gpt-transcribe')).toBe('json');
    expect(transcriptionFormatFor('gpt-4o-mini-transcribe')).toBe('json');
  });
});

describe('parseTranscriptionResponse', () => {
  test('reads verbose_json segments', () => {
    const result = parseTranscriptionResponse(
      'verbose_json',
      { text: 'Hello there.', language: 'English', segments: [{ id: 0, start: 0, end: 1.5, text: ' Hello there. ' }] },
      'whisper-1',
    );
    expect(result).toEqual({ text: 'Hello there.', language: 'english', segments: [{ start: 0, end: 1.5, text: 'Hello there.' }], model: 'whisper-1' });
  });

  test('reads diarized_json segments and ignores speakers', () => {
    const result = parseTranscriptionResponse(
      'diarized_json',
      { text: '', segments: [{ type: 'transcript.text.segment', start: 2, end: 4, text: 'Amen.', speaker: 'A' }] },
      'gpt-4o-transcribe-diarize',
    );
    expect(result.text).toBe('Amen.');
    expect(result.segments).toEqual([{ start: 2, end: 4, text: 'Amen.' }]);
  });

  test('returns null segments for text-only models', () => {
    const result = parseTranscriptionResponse('json', { text: 'Grace and peace.', languages: ['en'] }, 'gpt-transcribe');
    expect(result.segments).toBeNull();
    expect(result.language).toBe('en');
  });

  test('rejects non-object bodies', () => {
    expect(() => parseTranscriptionResponse('json', 'oops', 'gpt-transcribe')).toThrow(ProviderError);
  });
});

describe('extractStructuredOutput', () => {
  test('parses the JSON text of the first output message', () => {
    expect(extractStructuredOutput(completed('{"answer":"x"}'))).toEqual({ output: { answer: 'x' }, model: 'gpt-test-2026-10-01' });
  });

  test('maps refusals, truncation and junk to error codes', () => {
    const codeOf = (body: unknown) => {
      try {
        extractStructuredOutput(body);
      } catch (error) {
        return (error as ProviderError).code;
      }
      return 'none';
    };
    expect(codeOf({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] })).toBe('refused');
    expect(codeOf({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] })).toBe('output_truncated');
    expect(codeOf(completed('{not json'))).toBe('invalid_output');
    expect(codeOf({ status: 'completed', output: [{ type: 'reasoning', summary: [] }] })).toBe('invalid_output');
    expect(codeOf({ error: { message: 'x' } })).toBe('provider_error');
  });
});

describe('createOpenAiProvider.generate', () => {
  test('sends a strict json_schema request with store=false and returns the parsed output', async () => {
    const fetchFn = jest.fn(async () => fakeResponse(200, completed('{"ok":true}')));
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      transcribeModel: 'whisper-1',
      textModel: 'text-model',
      fetchFn: fetchFn as unknown as typeof fetch,
      reasoningEffort: 'low',
    });

    const result = await provider.generate({
      instructions: 'system',
      input: [{ role: 'user', content: 'hello' }],
      schemaName: 'thing',
      schema: { type: 'object' },
      maxOutputTokens: 100,
      timeoutMs: 1_000,
    });

    expect(result).toEqual({ output: { ok: true }, model: 'gpt-test-2026-10-01' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const payload = JSON.parse(init.body as string);
    expect(payload).toMatchObject({
      model: 'text-model',
      instructions: 'system',
      store: false,
      max_output_tokens: 100,
      reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', name: 'thing', strict: true, schema: { type: 'object' } } },
    });
  });

  test('retries once on a transient error, then maps HTTP failures to codes', async () => {
    const sleep = jest.fn(async () => undefined);
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(fakeResponse(503, {}))
      .mockResolvedValueOnce(fakeResponse(200, completed('{"ok":1}')));
    const provider = createOpenAiProvider({ apiKey: 'k', transcribeModel: 't', textModel: 'm', fetchFn, sleep });
    const request = { instructions: 's', input: [], schemaName: 'n', schema: {}, maxOutputTokens: 1, timeoutMs: 1_000 };

    await expect(provider.generate(request)).resolves.toEqual({ output: { ok: 1 }, model: 'gpt-test-2026-10-01' });
    expect(sleep).toHaveBeenCalledTimes(1);

    fetchFn.mockResolvedValueOnce(fakeResponse(401, {}));
    await expect(provider.generate(request)).rejects.toMatchObject({ code: 'not_configured', httpStatus: 401 });

    fetchFn.mockResolvedValueOnce(fakeResponse(400, {}));
    await expect(provider.generate(request)).rejects.toMatchObject({ code: 'provider_error' });
  });
});
