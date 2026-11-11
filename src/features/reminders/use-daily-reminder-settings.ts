import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { usePreferences } from '@/stores/preferences';

import { applyDailyReminder, type DailyReminderOutcome } from './daily-reminder';
import { useDailyReminderStore } from './daily-reminder-store';
import { getNotificationPermissionState, type PermissionState } from './scheduler';
import { DEFAULT_REMINDER_TIME } from './time-of-day';

const OUTCOME_MESSAGES: Partial<Record<DailyReminderOutcome, string>> = {
  denied: 'Notifications are turned off for Faithscroll. You can allow them in your device settings whenever you like.',
  failed: 'We couldn’t set the reminder just now. Please try again.',
  invalid: 'That time doesn’t look right. Please choose another.',
};

export interface DailyReminderSettings {
  enabled: boolean;
  time: string;
  /** True when a notification is actually scheduled with the OS. */
  isScheduled: boolean;
  permission: PermissionState | null;
  isBusy: boolean;
  message: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
  setTime: (time: string) => Promise<void>;
}

/** State and actions for the daily reading reminder row in Settings › Reminders. */
export function useDailyReminderSettings(): DailyReminderSettings {
  const enabled = usePreferences((s) => s.dailyReminderEnabled);
  const savedTime = usePreferences((s) => s.dailyReminderTime);
  const setDailyReminder = usePreferences((s) => s.setDailyReminder);
  const notificationId = useDailyReminderStore((s) => s.notificationId);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const time = savedTime ?? DEFAULT_REMINDER_TIME;

  const refreshPermission = useCallback(() => {
    void getNotificationPermissionState().then(setPermission);
  }, []);

  useEffect(() => {
    refreshPermission();
    // The user may come back from the system Settings app with a different choice.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission();
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  const apply = useCallback(
    async (nextEnabled: boolean, nextTime: string) => {
      setBusy(true);
      setMessage(null);
      try {
        const outcome = await applyDailyReminder(nextEnabled, nextTime);
        setMessage(OUTCOME_MESSAGES[outcome] ?? null);
      } finally {
        setBusy(false);
        refreshPermission();
      }
    },
    [refreshPermission],
  );

  const setEnabled = useCallback((next: boolean) => apply(next, time), [apply, time]);

  const setTime = useCallback(
    async (nextTime: string) => {
      if (enabled) return apply(true, nextTime);
      setDailyReminder(nextTime, false);
    },
    [apply, enabled, setDailyReminder],
  );

  return { enabled, time, isScheduled: notificationId !== null, permission, isBusy, message, setEnabled, setTime };
}
