import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import * as scheduler from '@/features/reminders/scheduler';
import { track } from '@/services/monitoring/analytics';

import {
  beginPlan,
  markDayComplete,
  markDayIncomplete,
  pausePlanWithReminder,
  planReminderCopy,
  reconcilePlanReminders,
  resumePlanWithReminder,
  stopPlanWithReminder,
  updatePlanReminder,
} from '../plan-service';
import { completePlanDay, getProgress, setPlanReminder, type PlanProgressRow } from '../repository';

jest.mock('@/features/reminders/scheduler', () => ({
  cancelReminder: jest.fn(async () => undefined),
  getNotificationPermissionState: jest.fn(async () => 'granted'),
  listScheduledReminderIds: jest.fn(async () => []),
  scheduleDailyReminderWithResult: jest.fn(async () => ({ status: 'scheduled', id: 'plan-notif' })),
}));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));

const mocked = jest.mocked(scheduler);

function progressOf(db: AppDatabase, id: string): PlanProgressRow {
  const row = getProgress(db, id);
  if (!row) throw new Error('missing progress');
  return row;
}

let db: AppDatabase;
beforeEach(() => {
  jest.clearAllMocks();
  db = createTestDb();
});

describe('plan service', () => {
  it('starts a plan and tracks it without content', () => {
    const id = beginPlan(db, 'john-21');
    expect(progressOf(db, id).status).toBe('active');
    expect(track).toHaveBeenCalledWith({ name: 'plan_started', planId: 'john-21' });
    expect(() => beginPlan(db, 'nope')).toThrow('Unknown reading plan');
  });

  it('schedules a gentle daily reminder for an active plan', async () => {
    const id = beginPlan(db, 'john-21');
    const result = await updatePlanReminder(db, progressOf(db, id), '07:15');
    expect(result).toEqual({ status: 'scheduled', id: 'plan-notif' });
    expect(mocked.scheduleDailyReminderWithResult).toHaveBeenCalledWith({ ...planReminderCopy('john-21'), hour: 7, minute: 15 });
    expect(planReminderCopy('john-21').url).toBe('/plans/john-21');
    expect(planReminderCopy('john-21').body).not.toMatch(/miss|streak|behind/i);
    expect(progressOf(db, id)).toMatchObject({ reminderTime: '07:15', reminderNotificationId: 'plan-notif' });
  });

  it('clears the reminder and the time when scheduling is denied', async () => {
    const id = beginPlan(db, 'john-21');
    mocked.scheduleDailyReminderWithResult.mockResolvedValueOnce({ status: 'denied' });
    await expect(updatePlanReminder(db, progressOf(db, id), '07:15')).resolves.toEqual({ status: 'denied' });
    expect(progressOf(db, id)).toMatchObject({ reminderTime: null, reminderNotificationId: null });
  });

  it('turns the reminder off', async () => {
    const id = beginPlan(db, 'john-21');
    setPlanReminder(db, id, '07:15', 'old');
    await expect(updatePlanReminder(db, progressOf(db, id), null)).resolves.toBeNull();
    expect(mocked.cancelReminder).toHaveBeenCalledWith('old');
    expect(progressOf(db, id)).toMatchObject({ reminderTime: null, reminderNotificationId: null });
  });

  it('keeps the time but does not schedule while paused', async () => {
    const id = beginPlan(db, 'john-21');
    setPlanReminder(db, id, '07:15', 'old');
    await pausePlanWithReminder(db, progressOf(db, id));
    expect(mocked.cancelReminder).toHaveBeenCalledWith('old');
    expect(progressOf(db, id)).toMatchObject({ status: 'paused', reminderTime: '07:15', reminderNotificationId: null });

    await updatePlanReminder(db, progressOf(db, id), '08:00');
    expect(mocked.scheduleDailyReminderWithResult).not.toHaveBeenCalled();
    expect(progressOf(db, id).reminderTime).toBe('08:00');

    const resumed = await resumePlanWithReminder(db, progressOf(db, id));
    expect(resumed).toEqual({ status: 'scheduled', id: 'plan-notif' });
    expect(progressOf(db, id)).toMatchObject({ status: 'active', reminderNotificationId: 'plan-notif' });
  });

  it('resumes without a reminder when none was set', async () => {
    const id = beginPlan(db, 'john-21');
    await pausePlanWithReminder(db, progressOf(db, id));
    await expect(resumePlanWithReminder(db, progressOf(db, id))).resolves.toBeNull();
    expect(mocked.cancelReminder).not.toHaveBeenCalled();
  });

  it('stops a plan and cancels its reminder', async () => {
    const id = beginPlan(db, 'john-21');
    setPlanReminder(db, id, '07:15', 'old');
    await stopPlanWithReminder(db, progressOf(db, id));
    expect(mocked.cancelReminder).toHaveBeenCalledWith('old');
    expect(progressOf(db, id).status).toBe('abandoned');
  });

  it('tracks day completion and cancels the reminder when the plan is finished', async () => {
    const id = beginPlan(db, 'hope-7');
    for (let day = 1; day <= 6; day += 1) completePlanDay(db, id, day, 7);
    setPlanReminder(db, id, '07:15', 'old');
    await expect(markDayComplete(db, progressOf(db, id), 7)).resolves.toEqual({ planCompleted: true });
    expect(track).toHaveBeenCalledWith({ name: 'plan_day_completed', planId: 'hope-7', day: 7 });
    expect(mocked.cancelReminder).toHaveBeenCalledWith('old');
    expect(progressOf(db, id)).toMatchObject({ status: 'completed', reminderTime: '07:15', reminderNotificationId: null });

    await markDayIncomplete(db, progressOf(db, id), 7);
    expect(progressOf(db, id)).toMatchObject({ status: 'active', reminderNotificationId: 'plan-notif' });
  });

  it('reconciles missing plan reminders at startup without prompting', async () => {
    const id = beginPlan(db, 'john-21');
    setPlanReminder(db, id, '06:45', 'lost');
    const paused = beginPlan(db, 'psalms-30');
    setPlanReminder(db, paused, '06:45', null);
    await pausePlanWithReminder(db, progressOf(db, paused));

    await reconcilePlanReminders(db);
    expect(mocked.scheduleDailyReminderWithResult).toHaveBeenCalledTimes(1);
    expect(progressOf(db, id).reminderNotificationId).toBe('plan-notif');

    mocked.scheduleDailyReminderWithResult.mockClear();
    mocked.listScheduledReminderIds.mockResolvedValueOnce(['plan-notif']);
    await reconcilePlanReminders(db);
    expect(mocked.scheduleDailyReminderWithResult).not.toHaveBeenCalled();

    mocked.getNotificationPermissionState.mockResolvedValueOnce('undetermined');
    setPlanReminder(db, id, '06:45', null);
    await reconcilePlanReminders(db);
    expect(mocked.scheduleDailyReminderWithResult).not.toHaveBeenCalled();
  });
});
