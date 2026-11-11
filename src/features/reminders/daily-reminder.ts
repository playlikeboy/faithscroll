/**
 * The daily reading reminder: one repeating local notification at the user's chosen time.
 * Gentle copy only — never mention streaks, missed days or anything that implies failure.
 */
import { usePreferences } from '@/stores/preferences';

import { useDailyReminderStore, whenHydrated } from './daily-reminder-store';
import {
  cancelReminder,
  getNotificationPermissionState,
  listScheduledReminderIds,
  scheduleDailyReminderWithResult,
} from './scheduler';
import { parseTimeOfDay } from './time-of-day';

export const DAILY_REMINDER_COPY = {
  title: 'Time with Scripture',
  body: 'A quiet moment to read, whenever you’re ready.',
  url: '/',
} as const;

export type DailyReminderOutcome = 'on' | 'off' | 'denied' | 'invalid' | 'failed';

async function cancelStoredReminder(): Promise<void> {
  const { notificationId, clearScheduled } = useDailyReminderStore.getState();
  if (notificationId) await cancelReminder(notificationId);
  clearScheduled();
}

/**
 * Turn the daily reminder on (asking for permission if needed) or off, and save the choice.
 * When permission is denied the preference is saved as "off" so the toggle reflects reality.
 */
export async function applyDailyReminder(enabled: boolean, time: string): Promise<DailyReminderOutcome> {
  await cancelStoredReminder();
  const { setDailyReminder } = usePreferences.getState();
  if (!enabled) {
    setDailyReminder(time, false);
    return 'off';
  }
  const parsed = parseTimeOfDay(time);
  if (!parsed) return 'invalid';

  const result = await scheduleDailyReminderWithResult({ ...DAILY_REMINDER_COPY, ...parsed });
  if (result.status === 'scheduled') {
    useDailyReminderStore.getState().setScheduled(result.id, time);
    setDailyReminder(time, true);
    return 'on';
  }
  setDailyReminder(time, false);
  return result.status;
}

/**
 * Startup reconciliation: make the OS schedule match the saved preference.
 * Never prompts — if permission hasn't been granted yet, nothing is scheduled until the user
 * turns the reminder on in Settings › Reminders.
 */
export async function reconcileDailyReminder(): Promise<void> {
  await Promise.all([whenHydrated(usePreferences), whenHydrated(useDailyReminderStore)]);
  const { dailyReminderEnabled, dailyReminderTime } = usePreferences.getState();
  const { notificationId, scheduledTime } = useDailyReminderStore.getState();
  const time = parseTimeOfDay(dailyReminderTime);

  if (!dailyReminderEnabled || !time) {
    if (notificationId) await cancelStoredReminder();
    return;
  }
  if ((await getNotificationPermissionState()) !== 'granted') return;

  const scheduledIds = await listScheduledReminderIds();
  const upToDate = notificationId !== null && scheduledTime === dailyReminderTime && scheduledIds.includes(notificationId);
  if (upToDate) return;

  await cancelStoredReminder();
  const result = await scheduleDailyReminderWithResult({ ...DAILY_REMINDER_COPY, ...time });
  if (result.status === 'scheduled' && dailyReminderTime) {
    useDailyReminderStore.getState().setScheduled(result.id, dailyReminderTime);
  }
}
