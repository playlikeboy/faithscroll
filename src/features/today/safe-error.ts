/**
 * Drizzle query errors embed the SQL parameters (i.e. the user's text) in their message.
 * Strip them before anything reaches logs or crash reporting.
 */
export function contentFreeError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error('Unknown error');
  const cause = error.cause instanceof Error ? error.cause : null;
  const reason = cause ? `${cause.name}: ${cause.message}` : error.name;
  return new Error(reason);
}
