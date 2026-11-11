/**
 * Prayer reminders via the shared reminders contract. Lock-screen text is always generic
 * ("A gentle reminder to pray") — the prayer's title or words never appear in a notification.
 */
import type { AppDatabase } from '@/db/types';
import { cancelReminder, scheduleOneTimeReminderWithResult } from '@/features/reminders/notifications';
import { logger } from '@/lib/logger';

import { deletePrayer, getPrayer, setPrayerReminderFields } from './repository';
import { PRAYER_REMINDER_BODY, PRAYER_REMINDER_TITLE } from './types';

export type ReminderOutcome = 'scheduled' | 'cleared' | 'denied' | 'invalid' | 'failed';

export const REMINDER_OUTCOME_MESSAGES: Readonly<Record<Exclude<ReminderOutcome, 'scheduled' | 'cleared'>, string>> = {
  denied: 'Notifications are turned off for Faithscroll. You can allow them in Settings.',
  invalid: 'Please choose a time in the future.',
  failed: "We couldn't set that reminder. Please try again.",
};

export function isReminderUpcoming(reminderAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!reminderAt) return false;
  const time = new Date(reminderAt).getTime();
  return Number.isFinite(time) && time > now.getTime();
}

async function cancelQuietly(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await cancelReminder(notificationId);
  } catch (error) {
    logger.warn('Cancelling a prayer reminder failed', { error: String(error) });
  }
}

/**
 * Set (date) or clear (null) a prayer's reminder. A new reminder is scheduled before the old one
 * is cancelled, so a denied or failed attempt never loses the existing reminder.
 */
export async function setPrayerReminder(db: AppDatabase, prayerId: string, date: Date | null): Promise<ReminderOutcome> {
  try {
    const prayer = getPrayer(db, prayerId);
    if (!prayer) return 'failed';

    if (date === null) {
      await cancelQuietly(prayer.reminderNotificationId);
      setPrayerReminderFields(db, prayerId, null);
      return 'cleared';
    }
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return 'invalid';

    const result = await scheduleOneTimeReminderWithResult({
      title: PRAYER_REMINDER_TITLE,
      body: PRAYER_REMINDER_BODY,
      date,
      url: `/prayers/${prayerId}`,
    });
    if (result.status !== 'scheduled') return result.status;

    await cancelQuietly(prayer.reminderNotificationId);
    setPrayerReminderFields(db, prayerId, { reminderAt: date.toISOString(), notificationId: result.id });
    return 'scheduled';
  } catch (error) {
    logger.error('Setting a prayer reminder failed', error);
    return 'failed';
  }
}

/** Delete a prayer and cancel its scheduled reminder, if any. */
export async function deletePrayerWithReminder(db: AppDatabase, prayerId: string): Promise<void> {
  const deleted = deletePrayer(db, prayerId);
  await cancelQuietly(deleted?.reminderNotificationId ?? null);
}
