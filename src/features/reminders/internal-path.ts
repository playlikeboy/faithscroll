/** Longest deep-link path accepted from a notification payload. */
const MAX_PATH_LENGTH = 512;

// Whitespace and ASCII control characters are never part of an app route we generate.
const FORBIDDEN_CHARACTERS = /[\s\u0000-\u001f\u007f\\]/;

/**
 * True only for an in-app route path such as "/prayers/abc" or "/plans/john-21?day=3".
 * Rejects absolute URLs ("https://…", "faithscroll://…"), protocol-relative URLs ("//host"),
 * backslashes, whitespace/control characters and oversized values, so a notification payload
 * can never send the user outside the app.
 */
export function isInternalPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_PATH_LENGTH) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  return !FORBIDDEN_CHARACTERS.test(value);
}
