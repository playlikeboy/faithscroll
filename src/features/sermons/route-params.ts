const POSITION_PATTERN = /^\d{1,10}$/;

/** `?t=<ms>` deep-link parameter → a non-negative position, or null when absent/malformed. */
export function parsePositionParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !POSITION_PATTERN.test(raw)) return null;
  return Number(raw);
}

/** A single string route param (ids), or null. */
export function parseIdParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length <= 128 ? raw : null;
}
