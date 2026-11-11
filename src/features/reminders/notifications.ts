/**
 * CONTRACT — owned by the library agent (reminders).
 * Local notification scheduling shared by prayers, action items, reading plans and the daily reminder.
 *
 * Privacy: notification text is visible on the lock screen. Callers must NOT put prayer/journal
 * content in `body` by default — use generic copy such as "A gentle reminder to pray".
 * Permission is requested only when the user turns a reminder on (never during onboarding).
 */
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';

import { logger } from '@/lib/logger';

import { reconcileDailyReminder } from './daily-reminder';
import { isInternalPath } from './internal-path';

export {
  cancelReminder,
  ensureNotificationPermission,
  getNotificationPermissionState,
  listScheduledReminderIds,
  REMINDER_CHANNEL_ID,
  scheduleDailyReminder,
  scheduleDailyReminderWithResult,
  scheduleOneTimeReminder,
  scheduleOneTimeReminderWithResult,
  type DailyReminder,
  type OneTimeReminder,
  type PermissionState,
  type ScheduleResult,
} from './scheduler';
export { isInternalPath } from './internal-path';

/** While the app is open, show reminders quietly in the banner and list. */
const FOREGROUND_BEHAVIOR: Notifications.NotificationBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: false,
  shouldSetBadge: false,
};

const NAVIGATION_RETRY_MS = 250;
const NAVIGATION_MAX_ATTEMPTS = 20;

/**
 * Navigate once the root navigator is mounted. On a cold start from a notification tap the
 * response can arrive before the Stack exists, in which case `router.push` throws; retry briefly.
 */
function navigateWhenReady(path: string, attempt = 0): void {
  try {
    router.push(path as Href);
  } catch (error) {
    if (attempt + 1 >= NAVIGATION_MAX_ATTEMPTS) {
      logger.error('Opening a reminder failed', error);
      return;
    }
    setTimeout(() => navigateWhenReady(path, attempt + 1), NAVIGATION_RETRY_MS);
  }
}

export interface InitNotificationsOptions {
  /** Override navigation (tests). Receives an already-validated internal path. */
  navigate?: (path: string) => void;
  /** Skip startup reconciliation of the daily reminder (tests). */
  skipReconcile?: boolean;
}

function responseKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.request.identifier}:${response.notification.date}`;
}

/** Called once at startup: notification handler + tap-to-open routing. Returns a cleanup function. */
export function initNotifications(options: InitNotificationsOptions = {}): () => void {
  const navigate = options.navigate ?? ((path: string) => navigateWhenReady(path));
  const handled = new Set<string>();

  Notifications.setNotificationHandler({
    handleNotification: async () => FOREGROUND_BEHAVIOR,
  });

  const handleResponse = (response: Notifications.NotificationResponse): void => {
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = responseKey(response);
    if (handled.has(key)) return;
    handled.add(key);
    const url = response.notification.request.content.data?.url;
    if (!isInternalPath(url)) {
      if (url !== undefined) logger.warn('Ignored a notification link that is not an in-app path');
      return;
    }
    navigate(url);
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

  try {
    const initial = Notifications.getLastNotificationResponse();
    if (initial) {
      handleResponse(initial);
      Notifications.clearLastNotificationResponse();
    }
  } catch (error) {
    logger.error('Reading the launch notification failed', error);
  }

  if (!options.skipReconcile) {
    reconcileDailyReminder().catch((error: unknown) => logger.error('Restoring the daily reminder failed', error));
  }

  return () => {
    subscription.remove();
  };
}
