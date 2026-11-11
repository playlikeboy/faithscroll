/**
 * Wire contract between the app and the `ai-*` Edge Functions.
 * Mirrors `supabase/functions/_shared/ai-core.ts` (server side). Responses are validated here
 * with Zod before anything is trusted on device.
 */
import { z } from 'zod';

export const AI_JOB_TYPES = ['transcribe', 'recap', 'study', 'ask'] as const;
export type AiJobType = (typeof AI_JOB_TYPES)[number];

export const AI_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export function isTerminalStatus(status: AiJobStatus | undefined): boolean {
  return status === 'completed' || status === 'failed';
}

// --- Requests --------------------------------------------------------------------------------

export interface TranscribePartInput {
  recordingId: string;
  /** Storage object path: `<uid>/<sermonId>/<recordingId>.m4a`. */
  path: string;
  durationMs: number;
  mimeType: string;
}

export interface TranscribeRequest {
  sermonId: string;
  parts: TranscribePartInput[];
  /** ISO-639-1 hint, or null to auto-detect. */
  language: string | null;
}

export interface RecapRequest {
  sermonId: string;
  source: 'transcript' | 'notes';
  /** Transcript lines prefixed with [mm:ss], or the user's notes. */
  content: string;
  title: string | null;
  speaker: string | null;
  mainPassage: string | null;
  /** Total recording length in seconds, or null when there is no recording. */
  durationSec: number | null;
}

export interface LexicalEntry {
  term: string;
  original: string;
  transliteration: string;
  language: 'hebrew' | 'aramaic' | 'greek';
  gloss: string;
  source: string;
}

export interface PassageContext {
  /** Canonical reference, e.g. "John 3:16–17". */
  reference: string;
  /** Translation abbreviation, e.g. "WEB". */
  translation: string;
  /** Verse text from the local (licensed) Bible, one verse per line with its number. */
  passageText: string;
}

export interface StudyRequest extends PassageContext {
  mode: 'basic' | 'advanced';
  /** Verified lexical data for the passage. Empty → the model must omit original-language notes. */
  lexicalData: LexicalEntry[];
}

export interface AskTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskRequest extends PassageContext {
  question: string;
  /** Previous turns of this in-memory conversation (most recent last). */
  history: AskTurn[];
}

// --- Responses -------------------------------------------------------------------------------

export const startJobResponseSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(AI_JOB_STATUSES),
});
export type StartJobResponse = z.output<typeof startJobResponseSchema>;

export const aiJobSchema = z.object({
  id: z.string(),
  type: z.enum(AI_JOB_TYPES),
  status: z.enum(AI_JOB_STATUSES),
  result: z.unknown().nullable(),
  errorCode: z.string().nullable(),
  progress: z.object({ done: z.number(), total: z.number() }).nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  updatedAt: z.string(),
});
export type AiJob = z.output<typeof aiJobSchema>;

export const transcriptPartSegmentSchema = z.object({
  /** Seconds from the start of this recording part. */
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

export const transcriptPartResultSchema = z.object({
  recordingId: z.string(),
  language: z.string().nullable(),
  text: z.string(),
  segments: z.array(transcriptPartSegmentSchema),
  /** True when the provider gave no timestamps and they were estimated from text length. */
  approximate: z.boolean(),
});
export type TranscriptPartResult = z.output<typeof transcriptPartResultSchema>;

export const transcriptionResultSchema = z.object({
  parts: z.array(transcriptPartResultSchema),
});
export type TranscriptionResult = z.output<typeof transcriptionResultSchema>;

export const generationResultSchema = z.object({
  output: z.unknown(),
});

export const askResponseSchema = z.object({
  answer: z.unknown(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
});
