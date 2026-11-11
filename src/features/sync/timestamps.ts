/**
 * Postgres timestamptz strings carry microseconds and a numeric offset
 * ("2026-11-11T10:00:00.123456+00:00"); JS Dates only keep milliseconds. Pull cursors are kept as
 * the server's exact strings and compared at microsecond precision.
 */
const PATTERN = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

function normaliseOffset(offset: string | undefined): string {
  if (!offset || offset === 'Z') return 'Z';
  if (/^[+-]\d{2}$/.test(offset)) return `${offset}:00`;
  if (/^[+-]\d{4}$/.test(offset)) return `${offset.slice(0, 3)}:${offset.slice(3)}`;
  return offset;
}

/** Microseconds since the epoch, or NaN when unparseable. */
export function toMicros(value: string): number {
  const match = PATTERN.exec(value.trim());
  if (!match) return Number.NaN;
  const seconds = Date.parse(`${match[1].replace(' ', 'T')}${normaliseOffset(match[3])}`);
  if (Number.isNaN(seconds)) return Number.NaN;
  const fraction = Number((match[2] ?? '').slice(0, 6).padEnd(6, '0'));
  return seconds * 1000 + fraction;
}

/** The later of two server timestamps (null-safe). */
export function maxTimestamp(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  const ma = toMicros(a);
  const mb = toMicros(b);
  if (Number.isNaN(mb)) return a;
  if (Number.isNaN(ma)) return b;
  return mb > ma ? b : a;
}

/** ISO string `ms` milliseconds before `value` (used to re-read a small overlap window). */
export function shiftBack(value: string, ms: number): string {
  const micros = toMicros(value);
  if (Number.isNaN(micros)) return value;
  return new Date(Math.floor(micros / 1000) - ms).toISOString();
}

/** Device format for synced timestamps: `Date#toISOString()`; leaves unparseable values alone. */
export function toDeviceIso(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const micros = toMicros(value);
  return Number.isNaN(micros) ? value : new Date(Math.floor(micros / 1000)).toISOString();
}
