/**
 * Deno runtime glue shared by the `ai-*` Edge Functions: config from secrets, service-role client,
 * JWT verification, rate limiting, JSON responses and error handling.
 *
 * Privacy: logs carry event names, ids and error codes only — never prompts, transcripts,
 * notes, questions or model output.
 */
// eslint-disable-next-line import/no-unresolved -- Deno `npm:` specifier, resolved by the Edge Runtime.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { AiError, errorBody, MAX_JOBS_PER_MINUTE, toAiError } from './ai-core.ts';
import { createOpenAiProvider, type AiProvider } from './openai.ts';
import { resolveLimits, type Limits, type Plan, type QuotaDb } from './quota.ts';

/** Supabase Edge Runtime global (see jsr:@supabase/functions-js/edge-runtime.d.ts). */
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

export type AdminClient = SupabaseClient;

const MAX_BODY_BYTES = 512 * 1024;

export function env(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim().length > 0 ? value.trim() : null;
}

function intEnv(name: string, fallback: number): number {
  const value = Number(env(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function retentionDays(): number {
  return intEnv('AI_RESULT_RETENTION_DAYS', 30);
}

export function audioRetentionDays(): number {
  return intEnv('AI_AUDIO_RETENTION_DAYS', 30);
}

export function limits(): Record<Plan, Limits> {
  return resolveLimits(env('AI_LIMITS_JSON'));
}

let admin: AdminClient | null = null;

/** Service-role client. Bypasses RLS: always filter by the verified user id. */
export function adminClient(): AdminClient {
  if (admin) return admin;
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new AiError('not_configured');
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export function quotaDb(client: AdminClient): QuotaDb {
  return client as unknown as QuotaDb;
}

/** Configured AI provider. Only OpenAI is implemented; AI_PROVIDER selects it explicitly. */
export function createProvider(): AiProvider {
  const provider = env('AI_PROVIDER') ?? 'openai';
  if (provider !== 'openai') throw new AiError('not_configured');
  const apiKey = env('OPENAI_API_KEY');
  const transcribeModel = env('OPENAI_TRANSCRIBE_MODEL');
  const textModel = env('OPENAI_TEXT_MODEL');
  if (!apiKey || !transcribeModel || !textModel) throw new AiError('not_configured');
  return createOpenAiProvider({
    apiKey,
    transcribeModel,
    textModel,
    baseUrl: env('OPENAI_BASE_URL') ?? undefined,
    reasoningEffort: env('OPENAI_REASONING_EFFORT'),
    transcribeTimeoutMs: intEnv('OPENAI_TRANSCRIBE_TIMEOUT_MS', 300_000),
  });
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function ok(data: unknown): Response {
  return json(200, { data });
}

/** Structured log line without user content. */
export function log(event: string, fields: Record<string, string | number | boolean | null> = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}

/** Verify the caller's JWT and return their user id. Anonymous users cannot use AI. */
export async function requireUser(req: Request, client: AdminClient): Promise<string> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new AiError('signed_out');
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) throw new AiError('signed_out');
  return data.user.id;
}

export async function readJson(req: Request): Promise<unknown> {
  const length = Number(req.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY_BYTES) throw new AiError('invalid_request', 'Request too large');
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new AiError('invalid_request', 'Request too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError('invalid_request', 'Invalid JSON');
  }
}

/** Short burst limit on top of the monthly quota: at most N new jobs per user per minute. */
export async function enforceRateLimit(client: AdminClient, userId: string): Promise<void> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await client
    .from('ai_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  if (error) throw new AiError('server');
  if ((count ?? 0) >= MAX_JOBS_PER_MINUTE) throw new AiError('rate_limited');
}

/** Run work after the response is sent (Supabase Edge Runtime background task). */
export function background(task: Promise<unknown>): void {
  const guarded = task.catch((error) => log('background_task_failed', { code: toAiError(error).code }));
  EdgeRuntime.waitUntil(guarded);
}

type Handler = (req: Request) => Promise<Response>;

/** Common wrapper: CORS preflight, POST only, uniform error envelope. */
export function serveAi(name: string, handler: Handler): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') return json(405, errorBody(new AiError('invalid_request', 'Use POST')));
    try {
      return await handler(req);
    } catch (error) {
      const aiError = toAiError(error);
      if (aiError.status >= 500) log('ai_function_error', { fn: name, code: aiError.code });
      return json(aiError.status, errorBody(aiError));
    }
  });
}
