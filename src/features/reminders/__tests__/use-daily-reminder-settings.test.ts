import { act, renderHook } from '@testing-library/react-native';

import { usePreferences } from '@/stores/preferences';

import { applyDailyReminder } from '../daily-reminder';
import { useDailyReminderStore } from '../daily-reminder-store';
import { getNotificationPermissionState } from '../scheduler';
import { useDailyReminderSettings } from '../use-daily-reminder-settings';

jest.mock('../daily-reminder', () => ({ applyDailyReminder: jest.fn(async () => 'on') }));
jest.mock('../scheduler', () => ({ getNotificationPermissionState: jest.fn(async () => 'granted') }));

beforeEach(() => {
  jest.clearAllMocks();
  usePreferences.setState({ dailyReminderEnabled: false, dailyReminderTime: null });
  useDailyReminderStore.setState({ notificationId: null, scheduledTime: null });
});

describe('useDailyReminderSettings', () => {
  it('exposes the saved choice with a default time and the permission state', async () => {
    const { result } = await renderHook(() => useDailyReminderSettings());
    await act(async () => undefined);
    expect(result.current).toMatchObject({ enabled: false, time: '08:00', isScheduled: false, permission: 'granted', message: null });
  });

  it('turns the reminder on through applyDailyReminder', async () => {
    const { result } = await renderHook(() => useDailyReminderSettings());
    await act(async () => result.current.setEnabled(true));
    expect(applyDailyReminder).toHaveBeenCalledWith(true, '08:00');
    expect(result.current.isBusy).toBe(false);
  });

  it('explains a denied permission gently', async () => {
    jest.mocked(applyDailyReminder).mockResolvedValueOnce('denied');
    jest.mocked(getNotificationPermissionState).mockResolvedValue('denied');
    const { result } = await renderHook(() => useDailyReminderSettings());
    await act(async () => result.current.setEnabled(true));
    expect(result.current.message).toMatch(/turned off for Faithscroll/);
    expect(result.current.permission).toBe('denied');
  });

  it('saves a new time without scheduling while off, and reschedules while on', async () => {
    const { result, rerender } = await renderHook(() => useDailyReminderSettings());
    await act(async () => result.current.setTime('06:30'));
    expect(usePreferences.getState().dailyReminderTime).toBe('06:30');
    expect(applyDailyReminder).not.toHaveBeenCalled();

    await act(async () => usePreferences.setState({ dailyReminderEnabled: true }));
    await rerender({});
    await act(async () => result.current.setTime('21:00'));
    expect(applyDailyReminder).toHaveBeenCalledWith(true, '21:00');
  });
});
