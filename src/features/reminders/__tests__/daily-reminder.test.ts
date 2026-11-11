import { usePreferences } from '@/stores/preferences';

import { applyDailyReminder, DAILY_REMINDER_COPY, reconcileDailyReminder } from '../daily-reminder';
import { useDailyReminderStore } from '../daily-reminder-store';
import * as scheduler from '../scheduler';

jest.mock('../scheduler', () => ({
  cancelReminder: jest.fn(async () => undefined),
  getNotificationPermissionState: jest.fn(async () => 'granted'),
  listScheduledReminderIds: jest.fn(async () => []),
  scheduleDailyReminderWithResult: jest.fn(async () => ({ status: 'scheduled', id: 'daily-1' })),
}));

const mocked = jest.mocked(scheduler);

beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ dailyReminderEnabled: false, dailyReminderTime: null });
  useDailyReminderStore.setState({ notificationId: null, scheduledTime: null });
});

describe('applyDailyReminder', () => {
  it('schedules a gentle daily reminder and saves the choice', async () => {
    await expect(applyDailyReminder(true, '07:30')).resolves.toBe('on');
    expect(mocked.scheduleDailyReminderWithResult).toHaveBeenCalledWith({ ...DAILY_REMINDER_COPY, hour: 7, minute: 30 });
    expect(usePreferences.getState()).toMatchObject({ dailyReminderEnabled: true, dailyReminderTime: '07:30' });
    expect(useDailyReminderStore.getState()).toMatchObject({ notificationId: 'daily-1', scheduledTime: '07:30' });
  });

  it('replaces the previously scheduled reminder', async () => {
    useDailyReminderStore.setState({ notificationId: 'old', scheduledTime: '06:00' });
    await applyDailyReminder(true, '21:15');
    expect(mocked.cancelReminder).toHaveBeenCalledWith('old');
    expect(useDailyReminderStore.getState().notificationId).toBe('daily-1');
  });

  it('turns the reminder off and cancels it', async () => {
    useDailyReminderStore.setState({ notificationId: 'old', scheduledTime: '06:00' });
    await expect(applyDailyReminder(false, '06:00')).resolves.toBe('off');
    expect(mocked.cancelReminder).toHaveBeenCalledWith('old');
    expect(usePreferences.getState().dailyReminderEnabled).toBe(false);
    expect(useDailyReminderStore.getState().notificationId).toBeNull();
  });

  it('saves "off" when permission is denied', async () => {
    mocked.scheduleDailyReminderWithResult.mockResolvedValueOnce({ status: 'denied' });
    await expect(applyDailyReminder(true, '07:30')).resolves.toBe('denied');
    expect(usePreferences.getState()).toMatchObject({ dailyReminderEnabled: false, dailyReminderTime: '07:30' });
  });

  it('rejects a malformed time without scheduling', async () => {
    await expect(applyDailyReminder(true, '7.30pm')).resolves.toBe('invalid');
    expect(mocked.scheduleDailyReminderWithResult).not.toHaveBeenCalled();
  });
});

describe('reconcileDailyReminder', () => {
  it('schedules a reminder chosen earlier once permission exists', async () => {
    usePreferences.setState({ dailyReminderEnabled: true, dailyReminderTime: '08:00' });
    await reconcileDailyReminder();
    expect(mocked.scheduleDailyReminderWithResult).toHaveBeenCalledWith({ ...DAILY_REMINDER_COPY, hour: 8, minute: 0 });
    expect(useDailyReminderStore.getState()).toMatchObject({ notificationId: 'daily-1', scheduledTime: '08:00' });
  });

  it('never prompts at startup when permission has not been granted', async () => {
    usePreferences.setState({ dailyReminderEnabled: true, dailyReminderTime: '08:00' });
    mocked.getNotificationPermissionState.mockResolvedValueOnce('undetermined');
    await reconcileDailyReminder();
    expect(mocked.scheduleDailyReminderWithResult).not.toHaveBeenCalled();
  });

  it('leaves an up-to-date reminder alone', async () => {
    usePreferences.setState({ dailyReminderEnabled: true, dailyReminderTime: '08:00' });
    useDailyReminderStore.setState({ notificationId: 'n1', scheduledTime: '08:00' });
    mocked.listScheduledReminderIds.mockResolvedValueOnce(['n1']);
    await reconcileDailyReminder();
    expect(mocked.scheduleDailyReminderWithResult).not.toHaveBeenCalled();
    expect(mocked.cancelReminder).not.toHaveBeenCalled();
  });

  it('reschedules when the OS lost the notification or the time changed', async () => {
    usePreferences.setState({ dailyReminderEnabled: true, dailyReminderTime: '09:00' });
    useDailyReminderStore.setState({ notificationId: 'n1', scheduledTime: '08:00' });
    mocked.listScheduledReminderIds.mockResolvedValueOnce(['n1']);
    await reconcileDailyReminder();
    expect(mocked.cancelReminder).toHaveBeenCalledWith('n1');
    expect(useDailyReminderStore.getState()).toMatchObject({ notificationId: 'daily-1', scheduledTime: '09:00' });
  });

  it('cancels a stale reminder when the preference is off', async () => {
    useDailyReminderStore.setState({ notificationId: 'n1', scheduledTime: '08:00' });
    await reconcileDailyReminder();
    expect(mocked.cancelReminder).toHaveBeenCalledWith('n1');
    expect(useDailyReminderStore.getState().notificationId).toBeNull();
  });
});
