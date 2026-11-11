/**
 * App logger. Never log user content (prayers, notes, transcripts, journal text).
 * In production, errors are forwarded to crash reporting via `setErrorReporter`.
 */
type ErrorReporter = (error: unknown, context?: Record<string, string | number | boolean>) => void;

let reporter: ErrorReporter | null = null;

export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) console.debug(`[faithscroll] ${message}`, context ?? '');
  },
  warn(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) console.warn(`[faithscroll] ${message}`, context ?? '');
  },
  error(message: string, error?: unknown, context?: Record<string, string | number | boolean>): void {
    if (__DEV__) console.error(`[faithscroll] ${message}`, error);
    reporter?.(error ?? new Error(message), { message, ...context });
  },
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
