import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { ActiveReminder } from '@/features/reminders/active-reminders';
import type { DailyReminderSettings } from '@/features/reminders/use-daily-reminder-settings';

import { ActiveReminderList, describeSchedule } from '../active-reminder-list';
import { DailyReminderSection } from '../daily-reminder-section';

// Screen tests render real RN trees; the first render can be slow under coverage instrumentation.
jest.setTimeout(30_000);

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, DateTimePickerAndroid: { open: jest.fn() } };
});

function settings(overrides: Partial<DailyReminderSettings> = {}): DailyReminderSettings {
  return {
    enabled: false,
    time: '07:30',
    isScheduled: false,
    permission: 'undetermined',
    isBusy: false,
    message: null,
    setEnabled: jest.fn(async () => undefined),
    setTime: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('DailyReminderSection', () => {
  it('turns the reminder on from the switch', async () => {
    const value = settings();
    await render(<DailyReminderSection settings={value} />);
    expect(screen.getByText('Off')).toBeTruthy();
    await fireEvent(screen.getByRole('switch', { name: 'Daily reading reminder' }), 'valueChange', true);
    expect(value.setEnabled).toHaveBeenCalledWith(true);
  });

  it('describes the schedule when on', async () => {
    await render(<DailyReminderSection settings={settings({ enabled: true, isScheduled: true, permission: 'granted' })} />);
    expect(screen.getByText(/Every day at 7.*30/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull();
  });

  it('offers to allow notifications when a chosen reminder is not scheduled yet', async () => {
    const value = settings({ enabled: true, isScheduled: false });
    await render(<DailyReminderSection settings={value} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications' }));
    expect(value.setEnabled).toHaveBeenCalledWith(true);
  });

  it('points to device settings when notifications are denied', async () => {
    await render(<DailyReminderSection settings={settings({ enabled: true, permission: 'denied' })} />);
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
  });

  it('shows a gentle error message', async () => {
    await render(<DailyReminderSection settings={settings({ message: 'We couldn’t set the reminder just now. Please try again.' })} />);
    expect(screen.getByText('We couldn’t set the reminder just now. Please try again.')).toBeTruthy();
  });
});

describe('ActiveReminderList', () => {
  const planReminder: ActiveReminder = {
    kind: 'plan',
    id: 'p1',
    title: 'The Gospel of John',
    schedule: { type: 'daily', time: '07:30' },
    href: '/plans/john-21',
  };

  it('shows the empty message', async () => {
    await render(<ActiveReminderList reminders={[]} emptyMessage="Nothing here." />);
    expect(screen.getByText('Nothing here.')).toBeTruthy();
  });

  it('opens the reminder source', async () => {
    await render(<ActiveReminderList reminders={[planReminder]} emptyMessage="Nothing here." />);
    await fireEvent.press(screen.getByRole('button', { name: /The Gospel of John/ }));
    expect(router.push).toHaveBeenCalledWith('/plans/john-21');
  });

  it('describes one-time schedules with a date', () => {
    const text = describeSchedule({ ...planReminder, kind: 'prayer', schedule: { type: 'once', at: '2026-11-12T08:00:00.000Z' } });
    expect(text).toMatch(/ at /);
    expect(describeSchedule({ ...planReminder, schedule: { type: 'daily', time: 'bad' } })).toBe('Every day');
  });
});
