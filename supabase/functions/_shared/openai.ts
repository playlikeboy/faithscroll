/**
 * OpenAI implementation of the AI provider interface (Audio Transcriptions + Responses API with
 * JSON-schema structured outputs). Web-standard APIs only (fetch, FormData, Blob), no imports with
 * runtime effect, so it runs in Deno and is unit tested from Jest.
 *
 * Model ids come from Edge Function secrets (OPENAI_TRANSCRIBE_MODEL, OPENAI_TEXT_MODEL).
 * Timestamp support depends on the transcription model (OpenAI docs, Nov 2026):
 * - whisper-1                → response_format=verbose_json + timestamp_granularities[]=segment
 * - gpt-4o-transcribe-diarize → response_format=diarized_json (+ chunking_strategy=auto)
 * - gpt-transcribe and others → response_format=json, text only (segments: null; the job runner
 *   estimates timestamps and marks them approximate)
 * Never log request or response bodies: they contain user content.
 */
import type { AiErrorCode, TranscriptSegment } from './ai-core.ts';
import type { PromptMessage } from './ai-prompts.ts';

export interface TranscribeAudioRequest {
  audio: Blob;
  fileName: string;
  language: string | null;
}

export interface RawTranscription {
  text: string;
  language: string | null;
  /** null when the model returned no timestamps. */
  segments: TranscriptSegment[] | null;
  model: string;
}

export interface GenerateRequest {
  instructions: string;
  input: PromptMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface GenerateResult {
  output: unknown;
  model: string;
}

/** Provider-neutral interface the job runners depend on. */
export interface AiProvider {
  readonly id: string;
  readonly transcribeModel: string;
  readonly textModel: string;
  transcribe(request: TranscribeAudioRequest): Promise<RawTranscription>;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export interface OpenAiConfig {
  apiKey: string;
  transcribeModel: string;
  textModel: string;
  baseUrl?: string;
  /** Optional `reasoning.effort` for reasoning models (e.g. "low"). */
  reasoningEffort?: string | null;
  transcribeTimeoutMs?: number;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** Thrown for provider failures; `code` is mapped to an AiError by `toAiError`. */
export class ProviderError extends Error {
  readonly code: AiErrorCode;
  readonly httpStatus: number | null;

  constructor(code: AiErrorCode, httpStatus: number | null = null) {
    super(`provider:${code}`);
    this.name = 'ProviderError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TRANSCRIBE_TIMEOUT_MS = 300_000;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 2_000;

/** Context only (not user content): helps recognise Bible book names and references. */
export const TRANSCRIPTION_PROMPT =
  'A Christian sermon or Bible teaching. It may mention Bible books and references such as Romans 8:28, 1 Corinthians 13 or Psalm 23.';

export type TranscriptionFormat = 'verbose_json' | 'diarized_json' | 'json';

export function transcriptionFormatFor(model: string): TranscriptionFormat {
  const id = model.toLowerCase();
  if (id.startsWith('whisper')) return 'verbose_json';
  if (id.includes('diarize')) return 'diarized_json';
  return 'json';
}

export function buildTranscriptionForm(request: TranscribeAudioRequest, model: string): FormData {
  const format = transcriptionFormatFor(model);
  const form = new FormData();
  form.append('file', request.audio, request.fileName);
  form.append('model', model);
  form.append('response_format', format);
  if (format === 'verbose_json') form.append('timestamp_granularities[]', 'segment');
  if (format === 'diarized_json') form.append('chunking_strategy', 'auto');
  else form.append('prompt', TRANSCRIPTION_PROMPT);
  if (request.language) {
    if (model.toLowerCase().startsWith('gpt-transcribe')) form.append('languages[]', request.language);
    else form.append('language', request.language);
  }
  return form;
}

type Json = Record<string, unknown>;

function asSegments(value: unknown): TranscriptSegment[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is Json => typeof item === 'object' && item !== null)
    .map((item) => ({
      start: typeof item.start === 'number' ? item.start : 0,
      end: typeof item.end === 'number' ? item.end : typeof item.start === 'number' ? item.start : 0,
      text: typeof item.text === 'string' ? item.text.trim() : '',
    }))
    .filter((segment) => segment.text.length > 0);
}

function languageOf(body: Json): string | null {
  const single = typeof body.language === 'string' ? body.language : null;
  const list = Array.isArray(body.languages) && typeof body.languages[0] === 'string' ? body.languages[0] : null;
  const value = (single ?? list)?.trim().toLowerCase().slice(0, 20);
  return value ? value : null;
}

export function parseTranscriptionResponse(format: TranscriptionFormat, body: unknown, model: string): RawTranscription {
  if (typeof body !== 'object' || body === null) throw new ProviderError('invalid_output');
  const json = body as Json;
  const segments = format === 'json' ? null : asSegments(json.segments);
  const text =
    typeof json.text === 'string' && json.text.trim().length > 0
      ? json.text.trim()
      : (segments ?? []).map((segment) => segment.text).join(' ');
  return { text, language: languageOf(json), segments: segments && segments.length > 0 ? segments : null, model };
}

/** Extract the JSON object from a Responses API result, mapping refusals and truncation. */
export function extractStructuredOutput(body: unknown): { output: unknown; model: string | null } {
  if (typeof body !== 'object' || body === null) throw new ProviderError('invalid_output');
  const json = body as Json;
  if (json.error) throw new ProviderError('provider_error');
  if (json.status === 'incomplete') throw new ProviderError('output_truncated');
  if (json.status === 'failed') throw new ProviderError('provider_error');

  const items = Array.isArray(json.output) ? (json.output as Json[]) : [];
  for (const item of items) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content as Json[]) {
      if (part?.type === 'refusal') throw new ProviderError('refused');
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        try {
          return { output: JSON.parse(part.text), model: typeof json.model === 'string' ? json.model : null };
        } catch {
          throw new ProviderError('invalid_output');
        }
      }
    }
  }
  throw new ProviderError('invalid_output');
}

function errorCodeForStatus(status: number): AiErrorCode {
  if (status === 413) return 'audio_too_large';
  if (status === 401 || status === 403) return 'not_configured';
  return 'provider_error';
}

export function createOpenAiProvider(config: OpenAiConfig): AiProvider {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fetchFn = config.fetchFn ?? fetch;
  const sleep = config.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const headers = { Authorization: `Bearer ${config.apiKey}` };

  async function post(path: string, makeBody: () => BodyInit, extraHeaders: Record<string, string>, timeoutMs: number): Promise<unknown> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetchFn(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { ...headers, ...extraHeaders },
        body: makeBody(),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return response.json();
      // Drain the body without reading it into logs.
      await response.body?.cancel().catch(() => undefined);
      if (attempt === 0 && RETRY_STATUSES.has(response.status)) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new ProviderError(errorCodeForStatus(response.status), response.status);
    }
    throw new ProviderError('provider_error');
  }

  return {
    id: 'openai',
    transcribeModel: config.transcribeModel,
    textModel: config.textModel,

    async transcribe(request) {
      const format = transcriptionFormatFor(config.transcribeModel);
      const body = await post(
        '/audio/transcriptions',
        () => buildTranscriptionForm(request, config.transcribeModel),
        {},
        config.transcribeTimeoutMs ?? DEFAULT_TRANSCRIBE_TIMEOUT_MS,
      );
      return parseTranscriptionResponse(format, body, config.transcribeModel);
    },

    async generate(request) {
      const payload = {
        model: config.textModel,
        instructions: request.instructions,
        input: request.input.map((message) => ({ role: message.role, content: message.content })),
        text: { format: { type: 'json_schema', name: request.schemaName, schema: request.schema, strict: true } },
        max_output_tokens: request.maxOutputTokens,
        // Do not retain prompts/responses on the provider side beyond processing.
        store: false,
        ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}),
      };
      const body = await post('/responses', () => JSON.stringify(payload), { 'Content-Type': 'application/json' }, request.timeoutMs);
      const { output, model } = extractStructuredOutput(body);
      return { output, model: model ?? config.textModel };
    },
  };
}
