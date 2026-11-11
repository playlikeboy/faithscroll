/**
 * Job store and background runners for the AI Edge Functions.
 *
 * Transcription is resumable: each recording part's result is written to `ai_jobs.result.parts[i]`
 * as soon as it finishes, with a heartbeat in `locked_at`. If a worker hits the Edge Function
 * wall-clock limit, `ai-job-status` re-claims the stale job and continues with the missing parts.
 * Recap/study inputs (transcripts, notes) are never persisted, so those jobs run once; a stale one
 * is marked failed with `timeout` and the user can retry.
 */
import {
  AiError,
  approximateSegments,
  isStale,
  MAX_AUDIO_BYTES,
  MAX_GENERATION_ATTEMPTS,
  MAX_TRANSCRIBE_ATTEMPTS,
  STALE_JOB_SECONDS,
  toAiError,
  type AiErrorCode,
  type JobRow,
  type JobType,
  type TranscribePart,
  type TranscriptPartResult,
  usagePeriod,
} from './ai-core.ts';
import type { Prompt } from './ai-prompts.ts';
import { SCHEMAS, type GenerationTask } from './ai-schemas.ts';
import { limits, log, quotaDb, retentionDays, type AdminClient } from './ai.ts';
import type { AiProvider } from './openai.ts';
import { releaseQuota, reserveQuota, resolvePlan, type QuotaKind } from './quota.ts';

export const AUDIO_BUCKET = 'sermon-audio';

export interface QuotaReservation {
  kind: QuotaKind;
  amount: number;
  period: string;
}

export interface NewJob {
  userId: string;
  type: JobType;
  sermonId: string | null;
  /** Metadata only — never transcripts, notes, passages or questions. */
  input: Record<string, unknown>;
  provider: AiProvider;
  status?: 'queued' | 'completed';
}

export async function createJob(client: AdminClient, job: NewJob): Promise<JobRow> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('ai_jobs')
    .insert({
      user_id: job.userId,
      job_type: job.type,
      sermon_id: job.sermonId,
      input: job.input,
      provider: job.provider.id,
      model: job.type === 'transcribe' ? job.provider.transcribeModel : job.provider.textModel,
      status: job.status ?? 'queued',
      ...(job.status === 'completed' ? { completed_at: now, expires_at: expiresAt() } : {}),
    })
    .select('*')
    .single();
  if (error || !data) throw new AiError('server');
  return data as JobRow;
}

/**
 * Entitlement + quota check, then create the job. The reservation is stored in `input.quota`
 * so a failed job gives the usage back; it is released immediately if the insert fails.
 */
export async function reserveAndCreateJob(
  client: AdminClient,
  provider: AiProvider,
  params: { userId: string; type: QuotaKind; sermonId: string | null; amount: number; mode?: string; input: Record<string, unknown> },
): Promise<JobRow> {
  const db = quotaDb(client);
  const now = new Date();
  const plan = await resolvePlan(db, params.userId, now);
  const decision = await reserveQuota(db, {
    userId: params.userId,
    kind: params.type,
    amount: params.amount,
    plan,
    limits: limits(),
    mode: params.mode,
  });
  if (!decision.ok) throw new AiError(decision.code);

  const quota: QuotaReservation = { kind: params.type, amount: params.amount, period: usagePeriod(now) };
  try {
    return await createJob(client, {
      userId: params.userId,
      type: params.type,
      sermonId: params.sermonId,
      input: { ...params.input, plan, quota },
      provider,
    });
  } catch (error) {
    await releaseQuota(db, { userId: params.userId, ...quota }).catch(() => undefined);
    throw error;
  }
}

export async function getUserJob(client: AdminClient, userId: string, jobId: string): Promise<JobRow> {
  const { data, error } = await client.from('ai_jobs').select('*').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error) throw new AiError('server');
  if (!data) throw new AiError('not_found');
  return data as JobRow;
}

function expiresAt(): string {
  return new Date(Date.now() + retentionDays() * 86_400_000).toISOString();
}

async function patchJob(client: AdminClient, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await client.from('ai_jobs').update(patch).eq('id', id);
  if (error) throw new AiError('server');
}

function reservationOf(job: JobRow): QuotaReservation | null {
  const quota = job.input.quota as Partial<QuotaReservation> | undefined;
  if (!quota || typeof quota.kind !== 'string' || typeof quota.amount !== 'number' || typeof quota.period !== 'string') return null;
  return { kind: quota.kind as QuotaKind, amount: quota.amount, period: quota.period };
}

export async function failJob(client: AdminClient, job: JobRow, code: AiErrorCode): Promise<void> {
  await patchJob(client, job.id, {
    status: 'failed',
    error_code: code,
    locked_at: null,
    completed_at: new Date().toISOString(),
    expires_at: expiresAt(),
  });
  const reservation = reservationOf(job);
  if (reservation) {
    await releaseQuota(quotaDb(client), { userId: job.user_id, ...reservation }).catch(() => undefined);
  }
  log('ai_job_failed', { type: job.job_type, code, attempts: job.attempts });
}

async function completeJob(client: AdminClient, job: JobRow, result: Record<string, unknown> | null, model: string): Promise<void> {
  await patchJob(client, job.id, {
    status: 'completed',
    result,
    model,
    error_code: null,
    locked_at: null,
    completed_at: new Date().toISOString(),
    expires_at: expiresAt(),
  });
  log('ai_job_completed', { type: job.job_type, attempts: job.attempts });
}

async function claimJob(client: AdminClient, jobId: string, maxAttempts: number): Promise<JobRow | null> {
  const { data, error } = await client.rpc('ai_claim_job', {
    p_job_id: jobId,
    p_stale_seconds: STALE_JOB_SECONDS,
    p_max_attempts: maxAttempts,
  });
  if (error) throw new AiError('server');
  const rows = (data ?? []) as JobRow[];
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------------------------

function isNotFound(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: string | number; message?: string };
  return e.status === 404 || String(e.statusCode) === '404' || /not.?found/i.test(e.message ?? '');
}

async function transcribePart(
  client: AdminClient,
  provider: AiProvider,
  part: TranscribePart,
  language: string | null,
): Promise<TranscriptPartResult> {
  const { data, error } = await client.storage.from(AUDIO_BUCKET).download(part.path);
  if (error || !data) throw new AiError(error && !isNotFound(error) ? 'server' : 'audio_missing');
  if (data.size > MAX_AUDIO_BYTES) throw new AiError('audio_too_large');

  const fileName = part.path.split('/').pop() ?? 'audio.m4a';
  const audio = data.type ? data : new Blob([data], { type: part.mimeType });
  const raw = await provider.transcribe({ audio, fileName, language });
  return {
    recordingId: part.recordingId,
    language: raw.language,
    text: raw.text,
    segments: raw.segments ?? approximateSegments(raw.text, part.durationMs),
    approximate: raw.segments === null,
  };
}

function isRetryable(code: AiErrorCode): boolean {
  return code === 'timeout' || code === 'provider_error' || code === 'server';
}

export async function runTranscriptionJob(client: AdminClient, provider: AiProvider, jobId: string): Promise<void> {
  const job = await claimJob(client, jobId, MAX_TRANSCRIBE_ATTEMPTS);
  if (!job) return;

  const parts = (job.input.parts ?? []) as TranscribePart[];
  const language = typeof job.input.language === 'string' ? job.input.language : null;
  const previous = Array.isArray(job.result?.parts) ? (job.result.parts as (TranscriptPartResult | null)[]) : [];
  const results = parts.map((_, index) => previous[index] ?? null);

  try {
    for (let index = 0; index < parts.length; index += 1) {
      if (results[index]) continue;
      results[index] = await transcribePart(client, provider, parts[index], language);
      // Persist progress + heartbeat after every part.
      await patchJob(client, job.id, { result: { parts: results }, locked_at: new Date().toISOString() });
    }
    await completeJob(client, job, { parts: results }, provider.transcribeModel);
  } catch (error) {
    const code = toAiError(error).code;
    if (isRetryable(code) && job.attempts < MAX_TRANSCRIBE_ATTEMPTS) {
      // Release the lock: the next status poll re-claims the job and resumes missing parts.
      await patchJob(client, job.id, { locked_at: null }).catch(() => undefined);
      log('ai_job_retry_scheduled', { type: 'transcribe', code, attempts: job.attempts });
      return;
    }
    await failJob(client, job, code);
  }
}

// ---------------------------------------------------------------------------------------------
// Recap / study
// ---------------------------------------------------------------------------------------------

export interface GenerationOptions {
  task: GenerationTask;
  prompt: Prompt;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Server-side post-processing of the structured output (e.g. grounding rules). */
  postProcess?: (output: unknown) => unknown;
}

export async function runGenerationJob(
  client: AdminClient,
  provider: AiProvider,
  jobId: string,
  options: GenerationOptions,
): Promise<void> {
  const job = await claimJob(client, jobId, MAX_GENERATION_ATTEMPTS);
  if (!job) return;
  try {
    const { output, model } = await provider.generate({
      instructions: options.prompt.instructions,
      input: options.prompt.input,
      schemaName: SCHEMAS[options.task].name,
      schema: SCHEMAS[options.task].schema,
      maxOutputTokens: options.maxOutputTokens,
      timeoutMs: options.timeoutMs,
    });
    const finalOutput = options.postProcess ? options.postProcess(output) : output;
    await completeJob(client, job, { output: finalOutput }, model);
  } catch (error) {
    await failJob(client, job, toAiError(error).code);
  }
}

/**
 * Run a short generation inside the request (passage questions). The job row is kept for usage
 * accounting and rate limiting, but the answer is NOT stored: conversations live on the device only.
 */
export async function runInlineJob(
  client: AdminClient,
  provider: AiProvider,
  jobId: string,
  options: GenerationOptions,
): Promise<{ output: unknown; model: string }> {
  const job = await claimJob(client, jobId, 1);
  if (!job) throw new AiError('server');
  try {
    const result = await provider.generate({
      instructions: options.prompt.instructions,
      input: options.prompt.input,
      schemaName: SCHEMAS[options.task].name,
      schema: SCHEMAS[options.task].schema,
      maxOutputTokens: options.maxOutputTokens,
      timeoutMs: options.timeoutMs,
    });
    await completeJob(client, job, null, result.model);
    return result;
  } catch (error) {
    const aiError = toAiError(error);
    await failJob(client, job, aiError.code);
    throw aiError;
  }
}

// ---------------------------------------------------------------------------------------------
// Recovery (called from ai-job-status)
// ---------------------------------------------------------------------------------------------

/** A queued job that never started, or a processing job whose worker went silent. */
export function needsRecovery(job: JobRow, now: Date): boolean {
  if (job.status === 'queued') return now.getTime() - Date.parse(job.updated_at) > STALE_JOB_SECONDS * 1000;
  return isStale(job, now);
}

export type RecoveryAction = 'resume' | 'fail' | 'none';

export function recoveryAction(job: JobRow, now: Date): RecoveryAction {
  if (!needsRecovery(job, now)) return 'none';
  if (job.job_type === 'transcribe' && job.attempts < MAX_TRANSCRIBE_ATTEMPTS) return 'resume';
  return 'fail';
}
