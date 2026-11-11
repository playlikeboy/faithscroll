/**
 * Helpers for the preferred daily reminder time, stored in preferences as local "HH:mm".
 * Choosing a time never schedules anything — reminders are switched on later in Settings.
 */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_REMINDER_TIME = '07:30';

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function isValidTime(value: string | null | undefined): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

/** Local time of `date` as "HH:mm". */
export function dateToTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** A Date on `base`'s day at the given "HH:mm" (falls back to the default time when malformed). */
export function timeToDate(time: string | null | undefined, base: Date = new Date()): Date {
  const safe = isValidTime(time) ? time : DEFAULT_REMINDER_TIME;
  const [hours, minutes] = safe.split(':').map(Number);
  const result = new Date(base.getTime());
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/** Human-readable time in the user's locale, e.g. "7:30 AM" or "07:30". */
export function formatTime(time: string, locale?: string): string {
  return timeToDate(time).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}
