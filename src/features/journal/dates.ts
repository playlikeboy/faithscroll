import { toLocalDateString } from '@/lib/time';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a local calendar date (YYYY-MM-DD) into a Date at local midnight; null when malformed. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  const match = DATE_PATTERN.exec(value ?? '');
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return toLocalDateString(date) === value ? date : null;
}

/** "8 Nov 2026"-style date in the user's locale; returns the input unchanged when it can't be parsed. */
export function formatCalendarDate(value: string | null | undefined): string {
  const date = parseLocalDate(value);
  if (!date) return value ?? '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Section title for the journal timeline: "Today", "Yesterday" or a long date. */
export function formatDayHeading(value: string, today: Date = new Date()): string {
  const date = parseLocalDate(value);
  if (!date) return value;
  const todayKey = toLocalDateString(today);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (value === todayKey) return 'Today';
  if (value === toLocalDateString(yesterday)) return 'Yesterday';
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Date + time for reminders, e.g. "Tue, 12 Nov, 8:00 AM". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
