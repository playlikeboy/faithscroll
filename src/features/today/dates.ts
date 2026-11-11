import { dayPeriod } from '@/lib/time';

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const GREETINGS = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
} as const;

export function greetingFor(date: Date = new Date()): string {
  return GREETINGS[dayPeriod(date)];
}

/** "Wednesday, November 11" in the user's locale. */
export function formatLongDate(date: Date = new Date(), locale?: string): string {
  return date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Parse a local calendar date (YYYY-MM-DD) into a Date at local midnight. */
export function parseLocalDate(value: string): Date | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole days since 1970-01-01 for the local calendar date (stable across time zones). */
export function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/**
 * "Today", "Yesterday" or a short date ("Mon, Nov 9") for an ISO timestamp or a local YYYY-MM-DD date.
 * Returns null when the value can't be parsed.
 */
export function formatRelativeDay(value: string, now: Date = new Date(), locale?: string): string | null {
  const date = parseLocalDate(value) ?? new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = localDayNumber(now) - localDayNumber(date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}
