/**
 * Low-level local notification scheduling (expo-notifications).
 * Import through `@/features/reminders/notifications` — never call expo-notifications elsewhere.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

import { isInternalPath } from './internal-path';

/** Android notification channel used for every reminder the user sets. */
export const REMINDER_CHANNEL_ID = 'reminders';

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

/**
 * Detailed outcome of a scheduling attempt, so screens can explain what happened:
 * - `denied`: notifications are not allowed for the app (explain how to enable them).
 * - `invalid`: the date is in the past or the time is malformed.
 * - `failed`: the OS rejected the request (show a generic "couldn't set the reminder").
 */
export type ScheduleResult =
  | { status: 'scheduled'; id: string }
  | { status: 'denied' }
  | { status: 'invalid' }
  | { status: 'failed' };

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function isAllowed(status: Notifications.NotificationPermissionsStatus): boolean {
  return status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

/** Android 13+ shows the permission prompt only once a channel exists, so create it first. */
async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Reminders',
    description: 'Gentle reminders you choose to set for reading, prayer and plans.',
    importance: AndroidImportance.DEFAULT,
  });
}

/** Current permission without prompting the user. */
export async function getNotificationPermissionState(): Promise<PermissionState> {
  try {
    const status = await Notifications.getPermissionsAsync();
    if (isAllowed(status)) return 'granted';
    return status.canAskAgain ? 'undetermined' : 'denied';
  } catch (error) {
    logger.error('Reading notification permission failed', error);
    return 'denied';
  }
}

/** Ask for permission if needed. Returns true when notifications may be scheduled. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    await ensureReminderChannel();
    const current = await Notifications.getPermissionsAsync();
    if (isAllowed(current)) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return isAllowed(requested);
  } catch (error) {
    logger.error('Requesting notification permission failed', error);
    return false;
  }
}

function buildContent(title: string, body: string, url: string | undefined): Notifications.NotificationContentInput {
  if (url !== undefined && !isInternalPath(url)) {
    logger.warn('Reminder url ignored: only in-app paths are allowed');
  }
  return {
    title,
    body,
    sound: true,
    data: isInternalPath(url) ? { url } : {},
  };
}

function isValidTime(hour: number, minute: number): boolean {
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

async function schedule(
  content: Notifications.NotificationContentInput,
  trigger: Notifications.SchedulableNotificationTriggerInput,
): Promise<ScheduleResult> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) return { status: 'denied' };
  try {
    const id = await Notifications.scheduleNotificationAsync({ content, trigger });
    return { status: 'scheduled', id };
  } catch (error) {
    logger.error('Scheduling a reminder failed', error, { trigger: trigger.type ?? 'unknown' });
    return { status: 'failed' };
  }
}

export async function scheduleOneTimeReminderWithResult(reminder: OneTimeReminder): Promise<ScheduleResult> {
  const time = reminder.date.getTime();
  if (!Number.isFinite(time) || time <= Date.now()) return { status: 'invalid' };
  return schedule(buildContent(reminder.title, reminder.body, reminder.url), {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: reminder.date,
    channelId: REMINDER_CHANNEL_ID,
  });
}

export async function scheduleDailyReminderWithResult(reminder: DailyReminder): Promise<ScheduleResult> {
  if (!isValidTime(reminder.hour, reminder.minute)) return { status: 'invalid' };
  return schedule(buildContent(reminder.title, reminder.body, reminder.url), {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: reminder.hour,
    minute: reminder.minute,
    channelId: REMINDER_CHANNEL_ID,
  });
}

/** Returns the scheduled notification id, or null if permission was denied / date is in the past. */
export async function scheduleOneTimeReminder(reminder: OneTimeReminder): Promise<string | null> {
  const result = await scheduleOneTimeReminderWithResult(reminder);
  return result.status === 'scheduled' ? result.id : null;
}

export async function scheduleDailyReminder(reminder: DailyReminder): Promise<string | null> {
  const result = await scheduleDailyReminderWithResult(reminder);
  return result.status === 'scheduled' ? result.id : null;
}

export async function cancelReminder(notificationId: string): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    logger.error('Cancelling a reminder failed', error);
  }
}

/** Ids of every notification currently scheduled by the app. */
export async function listScheduledReminderIds(): Promise<string[]> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((request) => request.identifier);
  } catch (error) {
    logger.error('Listing scheduled reminders failed', error);
    return [];
  }
}
