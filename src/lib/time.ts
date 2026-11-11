export function nowIso(): string {
  return new Date().toISOString();
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Local calendar date as YYYY-MM-DD. */
export function toLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Format a duration in milliseconds as m:ss or h:mm:ss (e.g. 04:32, 1:02:07). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`;
}

/** Parse "mm:ss" or "h:mm:ss" into milliseconds; returns null when malformed. */
export function parseDuration(text: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  const minutes = Number(m);
  const seconds = Number(s);
  if (seconds > 59 || (h !== undefined && minutes > 59)) return null;
  return ((Number(h ?? 0) * 3600 + minutes * 60 + seconds) * 1000);
}

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

export function dayPeriod(date: Date = new Date()): DayPeriod {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
