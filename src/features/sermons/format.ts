import { toLocalDateString } from '@/lib/time';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidSermonDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

/** "2026-11-08" → "8 Nov 2026"; null when missing or malformed. */
export function formatSermonDate(value: string | null | undefined): string | null {
  if (!value || !isValidSermonDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Default title for a sermon created without one: "Sermon · 8 Nov 2026". */
export function defaultSermonTitle(sermonDate: string | null | undefined): string {
  const date = sermonDate && isValidSermonDate(sermonDate) ? sermonDate : toLocalDateString();
  return `Sermon · ${formatSermonDate(date)}`;
}

/** Display name of a recording part: its custom title, or "Part N" (index is zero-based). */
export function partLabel(part: { title: string | null }, index: number): string {
  const title = part.title?.trim();
  return title ? title : `Part ${index + 1}`;
}

/** Trim a free-text field; blank becomes null. */
export function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
