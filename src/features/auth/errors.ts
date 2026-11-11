/**
 * User-facing auth messages. Never echo emails, tokens or server error text back to the user or
 * the logs — map to calm, generic copy instead.
 */
export const NOT_CONFIGURED_MESSAGE =
  "Cloud features aren't set up in this version of Faithscroll. Everything else works on this device.";

export const OFFLINE_MESSAGE = "You appear to be offline. Check your connection and try again.";

export type AuthOutcome =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export const SUCCESS: AuthOutcome = { status: 'success' };
export const CANCELLED: AuthOutcome = { status: 'cancelled' };

export function failure(message: string): AuthOutcome {
  return { status: 'error', message };
}

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
}

/** True for transport failures (no response from the server). */
export function isNetworkError(error: unknown): boolean {
  const { name, message, status } = asErrorLike(error);
  if (name === 'AuthRetryableFetchError' || name === 'FunctionsFetchError') return true;
  if (status === 0) return true;
  return typeof message === 'string' && /network request failed|failed to fetch|network error|timed? ?out/i.test(message);
}

const CODE_MESSAGES: Record<string, string> = {
  over_email_send_rate_limit: 'Too many codes were requested. Please wait a minute, then try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute, then try again.',
  otp_expired: 'That code is incorrect or has expired. Check the latest email or request a new code.',
  otp_disabled: 'Email sign-in is turned off for this app right now.',
  email_address_invalid: 'Please enter a valid email address.',
  email_provider_disabled: 'Email sign-in is turned off for this app right now.',
  signup_disabled: 'New accounts are not being created right now.',
  user_banned: 'This account is not available.',
  provider_disabled: 'This sign-in method is turned off for this app right now.',
  bad_jwt: 'Your session has expired. Please sign in again.',
  session_not_found: 'Your session has expired. Please sign in again.',
};

/** Map any Supabase auth/functions error to a short, friendly message. */
export function friendlyAuthMessage(error: unknown, fallback = "We couldn't sign you in. Please try again."): string {
  if (isNetworkError(error)) return OFFLINE_MESSAGE;
  const { code, status } = asErrorLike(error);
  if (typeof code === 'string' && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (status === 429) return CODE_MESSAGES.over_request_rate_limit;
  return fallback;
}

/** Non-identifying context for logs (error class and status/code only). */
export function errorContext(error: unknown): Record<string, string | number | boolean> {
  const { name, code, status } = asErrorLike(error);
  const context: Record<string, string | number | boolean> = {};
  if (typeof name === 'string') context.name = name;
  if (typeof code === 'string') context.code = code;
  if (typeof status === 'number') context.status = status;
  return context;
}
