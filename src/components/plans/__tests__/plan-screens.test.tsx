import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import PlanScreen from '@/app/plans/[planId]';
import PlansScreen from '@/app/plans/index';
import { db } from '@/db/client';
import { notifyTables } from '@/features/library/testing/live-db-mocks';
import { getCurrentProgress } from '@/features/plans/repository';
import { track } from '@/services/monitoring/analytics';

jest.mock('expo-sqlite', () => jest.requireActual('@/features/library/testing/live-db-mocks').expoSqliteMock);
jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ planId: 'hope-7' })),
  Stack: { Screen: () => null },
}));
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, DateTimePickerAndroid: { open: jest.fn() } };
});
jest.mock('@/features/reminders/scheduler', () => ({
  cancelReminder: jest.fn(async () => undefined),
  getNotificationPermissionState: jest.fn(async () => 'granted'),
  listScheduledReminderIds: jest.fn(async () => []),
  scheduleDailyReminderWithResult: jest.fn(async () => ({ status: 'scheduled', id: 'n1' })),
}));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));

async function refresh() {
  await act(async () => notifyTables('plan_progress', 'plan_day_completions'));
}

describe('reading plan screens', () => {
  it('lists the catalog and opens a plan', async () => {
    await render(<PlansScreen />);
    expect(screen.getByText('Choose a plan')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Seven days of hope/ }));
    expect(router.push).toHaveBeenCalledWith('/plans/hope-7');
  });

  it('starts a plan, opens the reading, marks the day read and shows gentle progress', async () => {
    await render(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start plan' }));
    await refresh();
    expect(track).toHaveBeenCalledWith({ name: 'plan_started', planId: 'hope-7' });
    expect(screen.getByText('Day 1 of 7')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Read Lamentations 3:19–26' }));
    expect(router.push).toHaveBeenCalledWith('/bible/read/25/3?verse=19');

    await fireEvent.press(screen.getByRole('button', { name: 'Mark Day 1 as read' }));
    await refresh();
    expect(screen.getByText('Day 2 of 7')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Day 1 read' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByText(/missed|streak|behind/i)).toBeNull();
  });

  it('pauses and resumes the plan', async () => {
    await render(<PlanScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause plan' }));
    await refresh();
    expect(getCurrentProgress(db, 'hope-7')?.status).toBe('paused');
    expect(screen.getByText('Paused · Day 2 of 7')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume plan' }));
    await refresh();
    expect(getCurrentProgress(db, 'hope-7')?.status).toBe('active');
  });

  it('shows a calm empty state for an unknown plan', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValueOnce({ planId: 'missing' });
    await render(<PlanScreen />);
    expect(screen.getByText('Plan not found')).toBeTruthy();
  });
});
