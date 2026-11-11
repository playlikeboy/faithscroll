/**
 * Plan actions that combine the database with notifications and analytics.
 * Reminder copy is gentle and contains no personal content.
 */
import type { AppDatabase } from '@/db/types';
import {
  cancelReminder,
  getNotificationPermissionState,
  listScheduledReminderIds,
  scheduleDailyReminderWithResult,
  type ScheduleResult,
} from '@/features/reminders/scheduler';
import { parseTimeOfDay } from '@/features/reminders/time-of-day';
import { track } from '@/services/monitoring/analytics';

import { getPlan } from './catalog';
import {
  completePlanDay,
  getProgress,
  listCurrentProgress,
  pausePlan,
  resumePlan,
  setPlanReminder,
  startPlan,
  stopPlan,
  uncompletePlanDay,
  type PlanProgressRow,
} from './repository';

export function planReminderCopy(planId: string): { title: string; body: string; url: string } {
  const title = getPlan(planId)?.title ?? 'your reading plan';
  return {
    title: 'Your reading plan',
    body: `Today’s reading in ${title} is ready whenever you are.`,
    url: `/plans/${planId}`,
  };
}

async function scheduleFor(progress: PlanProgressRow, time: string): Promise<ScheduleResult> {
  const parsed = parseTimeOfDay(time);
  if (!parsed) return { status: 'invalid' };
  return scheduleDailyReminderWithResult({ ...planReminderCopy(progress.planId), ...parsed });
}

export function beginPlan(db: AppDatabase, planId: string): string {
  if (!getPlan(planId)) throw new Error('Unknown reading plan');
  const id = startPlan(db, planId);
  track({ name: 'plan_started', planId });
  return id;
}

/** Mark a day read; cancels the reminder once the whole plan is finished. */
export async function markDayComplete(db: AppDatabase, progress: PlanProgressRow, day: number): Promise<{ planCompleted: boolean }> {
  const plan = getPlan(progress.planId);
  if (!plan) throw new Error('Unknown reading plan');
  const result = completePlanDay(db, progress.id, day, plan.days.length);
  track({ name: 'plan_day_completed', planId: progress.planId, day });
  if (result.planCompleted && progress.reminderNotificationId) {
    await cancelReminder(progress.reminderNotificationId);
    setPlanReminder(db, progress.id, progress.reminderTime, null);
  }
  return result;
}

export async function markDayIncomplete(db: AppDatabase, progress: PlanProgressRow, day: number): Promise<void> {
  uncompletePlanDay(db, progress.id, day);
  const reopened = getProgress(db, progress.id);
  if (reopened?.status === 'active' && reopened.reminderTime && !reopened.reminderNotificationId) {
    const result = await scheduleFor(reopened, reopened.reminderTime);
    if (result.status === 'scheduled') setPlanReminder(db, progress.id, reopened.reminderTime, result.id);
  }
}

/** Pause: keep the chosen reminder time but stop notifying until the plan is resumed. */
export async function pausePlanWithReminder(db: AppDatabase, progress: PlanProgressRow): Promise<void> {
  if (progress.reminderNotificationId) await cancelReminder(progress.reminderNotificationId);
  pausePlan(db, progress.id);
  if (progress.reminderNotificationId) setPlanReminder(db, progress.id, progress.reminderTime, null);
}

export async function resumePlanWithReminder(db: AppDatabase, progress: PlanProgressRow): Promise<ScheduleResult | null> {
  resumePlan(db, progress.id);
  if (!progress.reminderTime) return null;
  const result = await scheduleFor(progress, progress.reminderTime);
  setPlanReminder(db, progress.id, progress.reminderTime, result.status === 'scheduled' ? result.id : null);
  return result;
}

export async function stopPlanWithReminder(db: AppDatabase, progress: PlanProgressRow): Promise<void> {
  if (progress.reminderNotificationId) await cancelReminder(progress.reminderNotificationId);
  stopPlan(db, progress.id);
}

/**
 * Startup reconciliation (e.g. after a reinstall or a sync from another device): make sure every
 * active plan with a reminder time has a scheduled notification. Never prompts for permission.
 */
export async function reconcilePlanReminders(db: AppDatabase): Promise<void> {
  if ((await getNotificationPermissionState()) !== 'granted') return;
  const scheduled = new Set(await listScheduledReminderIds());
  const active = listCurrentProgress(db).filter((row) => row.status === 'active' && row.reminderTime);
  for (const progress of active) {
    if (progress.reminderNotificationId && scheduled.has(progress.reminderNotificationId)) continue;
    const time = progress.reminderTime ?? '';
    const result = await scheduleFor(progress, time);
    if (result.status === 'scheduled') setPlanReminder(db, progress.id, time, result.id);
  }
}

/**
 * Set (time) or clear (null) the plan's daily reminder. Only active plans are scheduled;
 * a paused plan keeps the time and is scheduled again on resume.
 */
export async function updatePlanReminder(db: AppDatabase, progress: PlanProgressRow, time: string | null): Promise<ScheduleResult | null> {
  if (progress.reminderNotificationId) await cancelReminder(progress.reminderNotificationId);
  if (time === null) {
    setPlanReminder(db, progress.id, null, null);
    return null;
  }
  if (progress.status !== 'active') {
    setPlanReminder(db, progress.id, time, null);
    return null;
  }
  const result = await scheduleFor(progress, time);
  if (result.status === 'scheduled') {
    setPlanReminder(db, progress.id, time, result.id);
  } else {
    setPlanReminder(db, progress.id, null, null);
  }
  return result;
}
