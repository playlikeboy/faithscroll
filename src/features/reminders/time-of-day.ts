/** A local wall-clock time, stored as "HH:mm" in preferences and plan progress. */
export interface TimeOfDay {
  hour: number;
  minute: number;
}

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/** Parse "HH:mm" (24-hour). Returns null when malformed or out of range. */
export function parseTimeOfDay(value: string | null | undefined): TimeOfDay | null {
  if (!value) return null;
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Format as "HH:mm" (24-hour) for storage. */
export function formatTimeOfDay({ hour, minute }: TimeOfDay): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function dateToTimeOfDay(date: Date): TimeOfDay {
  return { hour: date.getHours(), minute: date.getMinutes() };
}

/** A Date today at the given local time (used to seed time pickers). */
export function timeOfDayToDate({ hour, minute }: TimeOfDay, base: Date = new Date()): Date {
  const date = new Date(base);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** Human-readable time in the device locale, e.g. "7:30 AM" or "07:30". */
export function formatTimeLabel(time: TimeOfDay): string {
  return timeOfDayToDate(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Default suggestion when the user turns a reminder on for the first time. */
export const DEFAULT_REMINDER_TIME = '08:00';
