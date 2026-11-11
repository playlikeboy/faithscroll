/**
 * Pure, runtime-agnostic core of the AI Edge Functions (no Deno or npm imports), so it is unit
 * tested from Jest (`src/services/ai/__tests__/server-*.test.ts`).
 *
 * Wire contract: mirrored by `src/services/ai/contracts.ts` on the client.
 */

// ---------------------------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------------------------

/** Transcription provider upload limit (25 MB). */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_TRANSCRIBE_PARTS = 12;
/** ~4 hours of audio per sermon. */
export const MAX_TRANSCRIBE_SECONDS = 4 * 60 * 60;
export const MAX_RECAP_CHARS = 200_000;
export const MAX_PASSAGE_CHARS = 20_000;
export const MAX_QUESTION_CHARS = 1_000;
export const MAX_HISTORY_TURNS = 6;
export const MAX_HISTORY_CHARS = 4_000;
export const MAX_LEXICAL_ENTRIES = 40;
/** A worker heartbeat older than this means the worker died; the job may be re-claimed. */
export const STALE_JOB_SECONDS = 180;
export const MAX_TRANSCRIBE_ATTEMPTS = 4;
/** Recap/study input is not persisted, so they cannot be resumed by another worker. */
export const MAX_GENERATION_ATTEMPTS = 1;
/** Jobs a user may start per minute (all types). */
export const MAX_JOBS_PER_MINUTE = 6;

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

export const AI_ERROR_CODES = [
  'invalid_request',
  'signed_out',
  'quota_exceeded',
  'plus_required',
  'rate_limited',
  'not_found',
  'not_configured',
  'audio_missing',
  'audio_too_large',
  'provider_error',
  'refused',
  'output_truncated',
  'invalid_output',
  'timeout',
  'server',
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

const STATUS_BY_CODE: Record<AiErrorCode, number> = {
  invalid_request: 400,
  signed_out: 401,
  quota_exceeded: 402,
  plus_required: 403,
  rate_limited: 429,
  not_found: 404,
  not_configured: 503,
  audio_missing: 409,
  audio_too_large: 413,
  provider_error: 502,
  refused: 422,
  output_truncated: 502,
  invalid_output: 502,
  timeout: 504,
  server: 500,
};

/** An error that is safe to show to the client: a stable code plus a generic message. */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;

  constructor(code: AiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isAiErrorCode(value: unknown): value is AiErrorCode {
  return typeof value === 'string' && (AI_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Normalise anything thrown into an AiError. Provider modules throw plain errors carrying a
 * `code` (they avoid value imports so they stay unit-testable), which are mapped here.
 */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return new AiError('timeout');
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (isAiErrorCode(code)) return new AiError(code);
  return new AiError('server');
}

export function errorBody(error: AiError): { error: { code: AiErrorCode; message: string } } {
  return { error: { code: error.code, message: error.message } };
}

// ---------------------------------------------------------------------------------------------
// Request validation (hand-written: keeps this module dependency-free)
// ---------------------------------------------------------------------------------------------

type Json = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LANGUAGE = /^[a-z]{2}$/;
const AUDIO_EXTENSION = /\.(m4a|mp4|aac|mp3|wav|webm)$/;

function invalid(field: string): never {
  throw new AiError('invalid_request', `Invalid ${field}`);
}

function asObject(value: unknown, field = 'body'): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(field);
  return value as Json;
}

function requireString(body: Json, field: string, max: number, { allowEmpty = false } = {}): string {
  const value = body[field];
  if (typeof value !== 'string') invalid(field);
  const trimmed = value.trim();
  if ((!allowEmpty && trimmed.length === 0) || trimmed.length > max) invalid(field);
  return trimmed;
}

function optionalString(body: Json, field: string, max: number): string | null {
  const value = body[field];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > max) invalid(field);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireUuid(body: Json, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || !UUID.test(value)) invalid(field);
  return value.toLowerCase();
}

/** Audio may only be read from the caller's own folder: `<uid>/<sermonId>/<recordingId>.<ext>`. */
export function isOwnedAudioPath(path: string, userId: string, sermonId: string, recordingId: string): boolean {
  if (path.includes('..') || path.includes('//') || path.startsWith('/')) return false;
  const parts = path.split('/');
  if (parts.length !== 3) return false;
  const [owner, sermon, file] = parts;
  return (
    owner.toLowerCase() === userId.toLowerCase() &&
    sermon.toLowerCase() === sermonId.toLowerCase() &&
    file.toLowerCase().startsWith(`${recordingId.toLowerCase()}.`) &&
    AUDIO_EXTENSION.test(file.toLowerCase())
  );
}

export interface TranscribePart {
  recordingId: string;
  path: string;
  durationMs: number;
  mimeType: string;
}

export interface TranscribeInput {
  sermonId: string;
  parts: TranscribePart[];
  language: string | null;
}

export function parseTranscribeRequest(raw: unknown, userId: string): TranscribeInput {
  const body = asObject(raw);
  const sermonId = requireUuid(body, 'sermonId');
  const rawParts = body.parts;
  if (!Array.isArray(rawParts) || rawParts.length === 0 || rawParts.length > MAX_TRANSCRIBE_PARTS) invalid('parts');

  const parts = rawParts.map((value, index): TranscribePart => {
    const part = asObject(value, `parts[${index}]`);
    const recordingId = requireUuid(part, 'recordingId');
    const path = requireString(part, 'path', 300);
    if (!isOwnedAudioPath(path, userId, sermonId, recordingId)) invalid(`parts[${index}].path`);
    const durationMs = part.durationMs;
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) invalid(`parts[${index}].durationMs`);
    const mimeType = optionalString(part, 'mimeType', 40) ?? 'audio/mp4';
    if (!mimeType.startsWith('audio/')) invalid(`parts[${index}].mimeType`);
    return { recordingId, path, durationMs: Math.round(durationMs), mimeType };
  });

  if (new Set(parts.map((part) => part.recordingId)).size !== parts.length) invalid('parts');
  if (totalSeconds(parts) > MAX_TRANSCRIBE_SECONDS) invalid('parts');

  const language = optionalString(body, 'language', 5);
  if (language !== null && !LANGUAGE.test(language)) invalid('language');
  return { sermonId, parts, language };
}

export function totalSeconds(parts: readonly TranscribePart[]): number {
  // Bill at least one second per part so empty-duration parts still count.
  return parts.reduce((sum, part) => sum + Math.max(1, Math.ceil(part.durationMs / 1000)), 0);
}

export interface RecapInput {
  sermonId: string;
  source: 'transcript' | 'notes';
  content: string;
  title: string | null;
  speaker: string | null;
  mainPassage: string | null;
  durationSec: number | null;
}

export function parseRecapRequest(raw: unknown): RecapInput {
  const body = asObject(raw);
  const source = body.source;
  if (source !== 'transcript' && source !== 'notes') invalid('source');
  const durationSec = body.durationSec;
  if (durationSec !== null && durationSec !== undefined && (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec < 0)) {
    invalid('durationSec');
  }
  return {
    sermonId: requireUuid(body, 'sermonId'),
    source,
    content: requireString(body, 'content', MAX_RECAP_CHARS),
    title: optionalString(body, 'title', 300),
    speaker: optionalString(body, 'speaker', 200),
    mainPassage: optionalString(body, 'mainPassage', 120),
    durationSec: typeof durationSec === 'number' ? durationSec : null,
  };
}

export interface PassageInput {
  reference: string;
  translation: string;
  passageText: string;
}

function parsePassage(body: Json): PassageInput {
  return {
    reference: requireString(body, 'reference', 120),
    translation: requireString(body, 'translation', 20),
    passageText: requireString(body, 'passageText', MAX_PASSAGE_CHARS),
  };
}

export interface LexicalEntry {
  term: string;
  original: string;
  transliteration: string;
  language: 'hebrew' | 'aramaic' | 'greek';
  gloss: string;
  source: string;
}

export interface StudyInput extends PassageInput {
  mode: 'basic' | 'advanced';
  lexicalData: LexicalEntry[];
}

export function parseStudyRequest(raw: unknown): StudyInput {
  const body = asObject(raw);
  const mode = body.mode;
  if (mode !== 'basic' && mode !== 'advanced') invalid('mode');
  const rawLexical = body.lexicalData ?? [];
  if (!Array.isArray(rawLexical) || rawLexical.length > MAX_LEXICAL_ENTRIES) invalid('lexicalData');
  const lexicalData = rawLexical.map((value, index): LexicalEntry => {
    const entry = asObject(value, `lexicalData[${index}]`);
    const language = entry.language;
    if (language !== 'hebrew' && language !== 'aramaic' && language !== 'greek') invalid(`lexicalData[${index}].language`);
    return {
      term: requireString(entry, 'term', 80),
      original: requireString(entry, 'original', 80),
      transliteration: requireString(entry, 'transliteration', 80),
      language,
      gloss: requireString(entry, 'gloss', 300),
      source: requireString(entry, 'source', 120),
    };
  });
  return { ...parsePassage(body), mode, lexicalData };
}

export interface AskTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskInput extends PassageInput {
  question: string;
  history: AskTurn[];
}

export function parseAskRequest(raw: unknown): AskInput {
  const body = asObject(raw);
  const rawHistory = body.history ?? [];
  if (!Array.isArray(rawHistory)) invalid('history');
  const history = rawHistory.slice(-MAX_HISTORY_TURNS).map((value, index): AskTurn => {
    const turn = asObject(value, `history[${index}]`);
    if (turn.role !== 'user' && turn.role !== 'assistant') invalid(`history[${index}].role`);
    const content = typeof turn.content === 'string' ? turn.content.trim().slice(0, MAX_HISTORY_CHARS) : invalid(`history[${index}].content`);
    return { role: turn.role, content };
  });
  return { ...parsePassage(body), question: requireString(body, 'question', MAX_QUESTION_CHARS), history };
}

export function parseJobStatusRequest(raw: unknown): { jobId: string } {
  return { jobId: requireUuid(asObject(raw), 'jobId') };
}

// ---------------------------------------------------------------------------------------------
// Transcription results
// ---------------------------------------------------------------------------------------------

export interface TranscriptSegment {
  /** Seconds from the start of the recording part. */
  start: number;
  end: number;
  text: string;
}

export interface TranscriptPartResult {
  recordingId: string;
  language: string | null;
  text: string;
  segments: TranscriptSegment[];
  approximate: boolean;
}

const MAX_APPROX_SEGMENT_CHARS = 280;

/** Split text into sentence-sized chunks of at most `max` characters. */
export function splitIntoChunks(text: string, max = MAX_APPROX_SEGMENT_CHARS): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [];
  const chunks: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (current && current.length + sentence.length + 1 > max) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current} ${sentence}` : sentence;
    while (current.length > max) {
      const cut = current.lastIndexOf(' ', max);
      const at = cut > max / 2 ? cut : max;
      chunks.push(current.slice(0, at).trim());
      current = current.slice(at).trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * For providers that return text without timestamps: spread sentence chunks across the part's
 * duration in proportion to their length. The result is flagged `approximate` for the UI.
 */
export function approximateSegments(text: string, durationMs: number): TranscriptSegment[] {
  const chunks = splitIntoChunks(text);
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (totalChars === 0) return [];
  const durationSec = Math.max(0, durationMs) / 1000;
  let consumed = 0;
  return chunks.map((chunk) => {
    const start = (consumed / totalChars) * durationSec;
    consumed += chunk.length;
    const end = (consumed / totalChars) * durationSec;
    return { start: round2(start), end: round2(end), text: chunk };
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------------------------

export type JobType = 'transcribe' | 'recap' | 'study' | 'ask';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface JobRow {
  id: string;
  user_id: string;
  job_type: JobType;
  status: JobStatus;
  sermon_id: string | null;
  input: Json;
  result: Json | null;
  provider: string | null;
  model: string | null;
  error_code: string | null;
  attempts: number;
  locked_at: string | null;
  updated_at: string;
}

export interface JobDto {
  id: string;
  type: JobType;
  status: JobStatus;
  result: unknown;
  errorCode: string | null;
  progress: { done: number; total: number } | null;
  provider: string | null;
  model: string | null;
  updatedAt: string;
}

export function jobProgress(row: Pick<JobRow, 'job_type' | 'input' | 'result'>): { done: number; total: number } | null {
  if (row.job_type !== 'transcribe') return null;
  const total = Array.isArray(row.input.parts) ? row.input.parts.length : 0;
  const parts = row.result && Array.isArray(row.result.parts) ? row.result.parts : [];
  return { done: parts.filter((part) => part !== null && part !== undefined).length, total };
}

/** Client view of a job row. Results are only exposed once the job has completed. */
export function toJobDto(row: JobRow): JobDto {
  return {
    id: row.id,
    type: row.job_type,
    status: row.status,
    result: row.status === 'completed' ? row.result : null,
    errorCode: row.status === 'failed' ? (row.error_code ?? 'server') : null,
    progress: jobProgress(row),
    provider: row.provider,
    model: row.model,
    updatedAt: row.updated_at,
  };
}

/** True when a processing job's worker has stopped sending heartbeats. */
export function isStale(row: Pick<JobRow, 'status' | 'locked_at'>, now: Date, staleSeconds = STALE_JOB_SECONDS): boolean {
  if (row.status !== 'processing') return false;
  if (!row.locked_at) return true;
  return now.getTime() - Date.parse(row.locked_at) > staleSeconds * 1000;
}

/** First day of the current UTC month, `YYYY-MM-01` (matches `ai_usage.period_start`). */
export function usagePeriod(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
