import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import {
  cancelReminder,
  ensureNotificationPermission,
  getNotificationPermissionState,
  initNotifications,
  isInternalPath,
  listScheduledReminderIds,
  REMINDER_CHANNEL_ID,
  scheduleDailyReminder,
  scheduleDailyReminderWithResult,
  scheduleOneTimeReminder,
  scheduleOneTimeReminderWithResult,
} from '../notifications';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('../daily-reminder', () => ({ reconcileDailyReminder: jest.fn(async () => undefined) }));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'notif-1'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
}));

const mocked = jest.mocked(Notifications);

function permission(granted: boolean, canAskAgain = true, iosStatus?: number) {
  return { granted, canAskAgain, status: granted ? 'granted' : 'undetermined', expires: 'never', ios: iosStatus === undefined ? undefined : { status: iosStatus } } as unknown as Notifications.NotificationPermissionsStatus;
}

function response(url: unknown, options: { action?: string; id?: string; date?: number } = {}): Notifications.NotificationResponse {
  return {
    actionIdentifier: options.action ?? Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: {
      date: options.date ?? 1,
      request: { identifier: options.id ?? 'n1', content: { data: url === undefined ? {} : { url } }, trigger: null },
    },
  } as unknown as Notifications.NotificationResponse;
}

const future = () => new Date(Date.now() + 60 * 60 * 1000);

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getPermissionsAsync.mockResolvedValue(permission(true));
  mocked.requestPermissionsAsync.mockResolvedValue(permission(true));
  mocked.scheduleNotificationAsync.mockResolvedValue('notif-1');
});

describe('isInternalPath', () => {
  it.each(['/', '/prayers/abc', '/plans/john-21?day=3', '/bible/read/43/3?verse=16'])('accepts %s', (value) => {
    expect(isInternalPath(value)).toBe(true);
  });

  it.each([
    'https://evil.example',
    'faithscroll://prayers/1',
    '//evil.example/path',
    '/\\evil.example',
    'prayers/abc',
    '',
    '/with space',
    '/line\nbreak',
    `/${'a'.repeat(600)}`,
    42,
    null,
    undefined,
    { url: '/x' },
  ])('rejects %p', (value) => {
    expect(isInternalPath(value)).toBe(false);
  });
});

describe('ensureNotificationPermission', () => {
  it('returns true without prompting when already granted', async () => {
    await expect(ensureNotificationPermission()).resolves.toBe(true);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('treats iOS provisional authorization as allowed', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, true, 3));
    await expect(ensureNotificationPermission()).resolves.toBe(true);
  });

  it('prompts when undetermined and reports the answer', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, true));
    mocked.requestPermissionsAsync.mockResolvedValue(permission(false, false));
    await expect(ensureNotificationPermission()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('does not prompt when the user can no longer be asked', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, false));
    await expect(ensureNotificationPermission()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns false when the native call throws', async () => {
    mocked.getPermissionsAsync.mockRejectedValue(new Error('native'));
    await expect(ensureNotificationPermission()).resolves.toBe(false);
  });

  it('creates the Android "Reminders" channel before checking permission', async () => {
    const restore = jest.replaceProperty(Platform, 'OS', 'android');
    await ensureNotificationPermission();
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_CHANNEL_ID,
      expect.objectContaining({ name: 'Reminders', importance: 5 }),
    );
    restore.restore();
  });

  it('does not create a channel on iOS', async () => {
    const restore = jest.replaceProperty(Platform, 'OS', 'ios');
    await ensureNotificationPermission();
    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
    restore.restore();
  });
});

describe('getNotificationPermissionState', () => {
  it('maps permission responses without prompting', async () => {
    await expect(getNotificationPermissionState()).resolves.toBe('granted');
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, true));
    await expect(getNotificationPermissionState()).resolves.toBe('undetermined');
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, false));
    await expect(getNotificationPermissionState()).resolves.toBe('denied');
    mocked.getPermissionsAsync.mockRejectedValue(new Error('native'));
    await expect(getNotificationPermissionState()).resolves.toBe('denied');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('scheduleOneTimeReminder', () => {
  it('schedules a date trigger on the reminders channel with the internal url', async () => {
    const date = future();
    const id = await scheduleOneTimeReminder({ title: 'Prayer', body: 'A gentle reminder to pray', date, url: '/prayers/p1' });
    expect(id).toBe('notif-1');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Prayer', body: 'A gentle reminder to pray', sound: true, data: { url: '/prayers/p1' } },
      trigger: { type: 'date', date, channelId: REMINDER_CHANNEL_ID },
    });
  });

  it('drops external urls from the payload', async () => {
    await scheduleOneTimeReminder({ title: 't', body: 'b', date: future(), url: 'https://evil.example' });
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ data: {} }) }),
    );
  });

  it('returns null for a date in the past without asking for permission', async () => {
    const result = await scheduleOneTimeReminderWithResult({ title: 't', body: 'b', date: new Date(Date.now() - 1000) });
    expect(result).toEqual({ status: 'invalid' });
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
    await expect(scheduleOneTimeReminder({ title: 't', body: 'b', date: new Date('invalid') })).resolves.toBeNull();
  });

  it('returns null when permission is denied', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission(false, false));
    await expect(scheduleOneTimeReminderWithResult({ title: 't', body: 'b', date: future() })).resolves.toEqual({ status: 'denied' });
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reports failure when the OS rejects the request', async () => {
    mocked.scheduleNotificationAsync.mockRejectedValue(new Error('native'));
    await expect(scheduleOneTimeReminderWithResult({ title: 't', body: 'b', date: future() })).resolves.toEqual({ status: 'failed' });
  });
});

describe('scheduleDailyReminder', () => {
  it('schedules a daily trigger', async () => {
    const id = await scheduleDailyReminder({ title: 'Read', body: 'b', hour: 7, minute: 30, url: '/' });
    expect(id).toBe('notif-1');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: { title: 'Read', body: 'b', sound: true, data: { url: '/' } },
      trigger: { type: 'daily', hour: 7, minute: 30, channelId: REMINDER_CHANNEL_ID },
    });
  });

  it.each([
    [24, 0],
    [-1, 0],
    [7, 60],
    [7.5, 0],
  ])('rejects invalid time %p:%p', async (hour, minute) => {
    await expect(scheduleDailyReminderWithResult({ title: 't', body: 'b', hour, minute })).resolves.toEqual({ status: 'invalid' });
  });
});

describe('cancelReminder / listScheduledReminderIds', () => {
  it('cancels by id and ignores empty ids', async () => {
    await cancelReminder('abc');
    await cancelReminder('');
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('abc');
  });

  it('does not throw when cancel fails', async () => {
    mocked.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('native'));
    await expect(cancelReminder('abc')).resolves.toBeUndefined();
  });

  it('lists scheduled ids and degrades to an empty list', async () => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: 'a' },
      { identifier: 'b' },
    ] as unknown as Notifications.NotificationRequest[]);
    await expect(listScheduledReminderIds()).resolves.toEqual(['a', 'b']);
    mocked.getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('native'));
    await expect(listScheduledReminderIds()).resolves.toEqual([]);
  });
});

describe('initNotifications', () => {
  function tapListener(): (r: Notifications.NotificationResponse) => void {
    return mocked.addNotificationResponseReceivedListener.mock.calls[0][0];
  }

  it('sets a quiet foreground handler', async () => {
    const stop = initNotifications({ skipReconcile: true, navigate: jest.fn() });
    const handler = mocked.setNotificationHandler.mock.calls[0][0];
    await expect(handler?.handleNotification({} as Notifications.Notification)).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
    stop();
  });

  it('routes taps to internal paths only', () => {
    const navigate = jest.fn();
    const stop = initNotifications({ skipReconcile: true, navigate });
    const onTap = tapListener();
    onTap(response('/prayers/p1', { id: 'a' }));
    onTap(response('https://evil.example', { id: 'b' }));
    onTap(response('//evil.example', { id: 'c' }));
    onTap(response(undefined, { id: 'd' }));
    onTap(response('/journal/j1', { id: 'e', action: 'custom-action' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/prayers/p1');
    stop();
  });

  it('handles the launch notification once and clears it', () => {
    const navigate = jest.fn();
    const launch = response('/plans/john-21', { id: 'x', date: 5 });
    mocked.getLastNotificationResponse.mockReturnValueOnce(launch);
    const stop = initNotifications({ skipReconcile: true, navigate });
    tapListener()(launch);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/plans/john-21');
    expect(mocked.clearLastNotificationResponse).toHaveBeenCalled();
    stop();
  });

  it('routes the same daily notification again on a later day', () => {
    const navigate = jest.fn();
    const stop = initNotifications({ skipReconcile: true, navigate });
    tapListener()(response('/', { id: 'daily', date: 1 }));
    tapListener()(response('/', { id: 'daily', date: 2 }));
    expect(navigate).toHaveBeenCalledTimes(2);
    stop();
  });

  it('uses the router by default and removes the listener on cleanup', () => {
    const stop = initNotifications({ skipReconcile: true });
    tapListener()(response('/library/actions'));
    expect(router.push).toHaveBeenCalledWith('/library/actions');
    stop();
    const subscription = mocked.addNotificationResponseReceivedListener.mock.results[0].value;
    expect(subscription.remove).toHaveBeenCalled();
  });

  it('retries navigation until the router is mounted', () => {
    jest.useFakeTimers();
    const push = jest.mocked(router.push);
    push.mockImplementationOnce(() => {
      throw new Error('not mounted');
    });
    const stop = initNotifications({ skipReconcile: true });
    tapListener()(response('/prayers/p2'));
    expect(push).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(300);
    expect(push).toHaveBeenCalledTimes(2);
    stop();
    jest.useRealTimers();
  });

  it('reconciles the daily reminder at startup', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { reconcileDailyReminder } = require('../daily-reminder') as { reconcileDailyReminder: jest.Mock };
    const stop = initNotifications({ navigate: jest.fn() });
    expect(reconcileDailyReminder).toHaveBeenCalled();
    stop();
  });
});
