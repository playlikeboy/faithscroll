/**
 * CONTRACT STUB — owned by the library agent (reminders).
 * Local notification scheduling shared by prayers, action items, reading plans and the daily reminder.
 *
 * Privacy: notification text is visible on the lock screen. Callers must NOT put prayer/journal
 * content in `body` by default — use generic copy such as "A gentle reminder to pray".
 * Permission is requested only when the user turns a reminder on (never during onboarding).
 */

export interface OneTimeReminder {
  title: string;
  body: string;
  date: Date;
  /** Deep link path opened when the notification is tapped, e.g. "/prayers/abc". */
  url?: string;
}

export interface DailyReminder {
  title: string;
  body: string;
  hour: number;
  minute: number;
  url?: string;
}

/** Ask for permission if needed. Returns true when notifications may be scheduled. */
export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

/** Returns the scheduled notification id, or null if permission was denied / date is in the past. */
export async function scheduleOneTimeReminder(_reminder: OneTimeReminder): Promise<string | null> {
  return null;
}

export async function scheduleDailyReminder(_reminder: DailyReminder): Promise<string | null> {
  return null;
}

export async function cancelReminder(_notificationId: string): Promise<void> {
  // no-op until implemented
}

/** Called once at startup: notification handler + tap-to-open routing. Returns a cleanup function. */
export function initNotifications(): () => void {
  return () => undefined;
}
