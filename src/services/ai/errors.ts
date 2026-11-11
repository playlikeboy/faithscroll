/**
 * Typed errors for every AI / upload call, with calm user-facing messages (PRD §6.3F "clear errors").
 */
export const AI_CLIENT_ERROR_CODES = [
  'not_configured',
  'signed_out',
  'offline',
  'quota_exceeded',
  'plus_required',
  'rate_limited',
  'invalid_request',
  'not_found',
  'audio_missing',
  'audio_too_large',
  'file_missing',
  'upload_failed',
  'refused',
  'invalid_output',
  'timeout',
  'cancelled',
  'server',
] as const;
export type AiClientErrorCode = (typeof AI_CLIENT_ERROR_CODES)[number];

export class AiServiceError extends Error {
  readonly code: AiClientErrorCode;

  constructor(code: AiClientErrorCode, message?: string) {
    super(message ?? aiErrorMessage(code));
    this.name = 'AiServiceError';
    this.code = code;
  }
}

const MESSAGES: Record<AiClientErrorCode, string> = {
  not_configured: 'Cloud features aren’t set up in this version of the app.',
  signed_out: 'Sign in to use AI features. Your notes and recordings stay on this device until you do.',
  offline: 'You seem to be offline. Check your connection and try again.',
  quota_exceeded: 'You’ve used this month’s AI allowance. Faithscroll Plus includes more.',
  plus_required: 'This is part of Faithscroll Plus.',
  rate_limited: 'That was a lot of requests at once. Please wait a minute and try again.',
  invalid_request: 'Something about this request wasn’t right. Please try again.',
  not_found: 'We couldn’t find that request any more. Please start again.',
  audio_missing: 'The uploaded audio is no longer in the cloud. Upload it again to continue.',
  audio_too_large: 'This recording part is too large to transcribe (25 MB limit).',
  file_missing: 'The recording file is missing from this device.',
  upload_failed: 'The upload didn’t finish. Your recording is safe on this device — try again.',
  refused: 'The AI couldn’t help with this request.',
  invalid_output: 'The AI returned something we couldn’t use. Please try again.',
  timeout: 'This took too long. Please try again.',
  cancelled: 'Cancelled.',
  server: 'Something went wrong on our side. Please try again in a moment.',
};

export function aiErrorMessage(code: AiClientErrorCode): string {
  return MESSAGES[code];
}

/** Errors that should open the paywall instead of an error message. */
export function needsPaywall(code: AiClientErrorCode): boolean {
  return code === 'quota_exceeded' || code === 'plus_required';
}

/** Errors worth an automatic or one-tap retry. */
export function isRetryable(code: AiClientErrorCode): boolean {
  return code === 'offline' || code === 'timeout' || code === 'server' || code === 'upload_failed' || code === 'rate_limited';
}

/** Map a server error code (see `_shared/ai-core.ts`) to a client code. */
export function fromServerCode(code: string | null | undefined, httpStatus?: number): AiClientErrorCode {
  if (code === 'provider_error') return 'server';
  if (code === 'output_truncated') return 'invalid_output';
  if (code && (AI_CLIENT_ERROR_CODES as readonly string[]).includes(code)) return code as AiClientErrorCode;
  if (httpStatus === 401) return 'signed_out';
  if (httpStatus === 402) return 'quota_exceeded';
  if (httpStatus === 403) return 'plus_required';
  if (httpStatus === 404) return 'not_found';
  if (httpStatus === 413) return 'audio_too_large';
  if (httpStatus === 429) return 'rate_limited';
  if (httpStatus === 503) return 'not_configured';
  return 'server';
}

export function toAiServiceError(error: unknown): AiServiceError {
  if (error instanceof AiServiceError) return error;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return new AiServiceError('timeout');
  return new AiServiceError('server');
}
