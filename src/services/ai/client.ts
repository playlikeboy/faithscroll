/**
 * Calls the `ai-*` Edge Functions through supabase-js (which attaches the user's JWT) and
 * validates the `{ data }` envelope with Zod. Every failure becomes an `AiServiceError`.
 */
import type { z } from 'zod';

import { getSupabase } from '@/services/supabase/client';

import { AiServiceError, fromServerCode } from './errors';

export type AiFunctionName = 'ai-transcribe' | 'ai-recap' | 'ai-study' | 'ai-ask' | 'ai-job-status';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Current access token, or a typed error when cloud features are unavailable. */
export async function getAccessToken(): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new AiServiceError('not_configured');
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new AiServiceError('signed_out');
  return token;
}

interface ResponseLike {
  status: number;
  json: () => Promise<unknown>;
}

function isResponseLike(value: unknown): value is ResponseLike {
  return typeof value === 'object' && value !== null && typeof (value as ResponseLike).status === 'number';
}

async function errorFromFunctions(error: unknown): Promise<AiServiceError> {
  const name = error instanceof Error ? error.name : '';
  if (name === 'FunctionsFetchError') return new AiServiceError('offline');
  if (name === 'FunctionsRelayError') return new AiServiceError('server');
  if (name === 'AbortError' || name === 'TimeoutError') return new AiServiceError('timeout');
  const context = (error as { context?: unknown } | null)?.context;
  if (name === 'FunctionsHttpError' && isResponseLike(context)) {
    let serverCode: string | null = null;
    try {
      const body = (await context.json()) as { error?: { code?: unknown } } | null;
      serverCode = typeof body?.error?.code === 'string' ? body.error.code : null;
    } catch {
      // Non-JSON error bodies fall back to the HTTP status.
    }
    return new AiServiceError(fromServerCode(serverCode, context.status));
  }
  return new AiServiceError('server');
}

export async function invokeAiFunction<T>(
  name: AiFunctionName,
  body: object,
  schema: z.ZodType<T>,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new AiServiceError('not_configured');
  await getAccessToken();

  let response: { data: unknown; error: unknown };
  try {
    response = await supabase.functions.invoke(name, { body: body as Record<string, unknown>, timeout: timeoutMs });
  } catch (error) {
    throw await errorFromFunctions(error);
  }
  if (response.error) throw await errorFromFunctions(response.error);

  const envelope = response.data as { data?: unknown } | null;
  if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) throw new AiServiceError('invalid_output');
  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) throw new AiServiceError('invalid_output');
  return parsed.data;
}
