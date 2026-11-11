import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import type { ScheduleResult } from '@/features/reminders/notifications';
import { logger } from '@/lib/logger';

import {
  beginPlan,
  markDayComplete,
  markDayIncomplete,
  pausePlanWithReminder,
  resumePlanWithReminder,
  stopPlanWithReminder,
  updatePlanReminder,
} from './plan-service';
import type { PlanWithProgress } from './plan-views';

const REMINDER_MESSAGES: Partial<Record<ScheduleResult['status'], string>> = {
  denied: 'Notifications are turned off for Faithscroll. You can allow them in your device settings whenever you like.',
  failed: 'We couldn’t set the reminder just now. Please try again.',
  invalid: 'That time doesn’t look right. Please choose another.',
};

export interface PlanActions {
  isBusy: boolean;
  message: string | null;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  toggleDay: (day: number) => Promise<void>;
  setReminder: (time: string | null) => Promise<void>;
}

/** Plan screen actions with busy state and gentle, user-facing error messages. */
export function usePlanActions(item: PlanWithProgress | null): PlanActions {
  const [isBusy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const progress = item?.progress;
  const planId = item?.plan.id;

  const run = useCallback(async (action: () => Promise<string | null | void>, failure: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const note = await action();
      if (note) setMessage(note);
    } catch (error) {
      logger.error('Reading plan action failed', error);
      setMessage(failure);
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(
    () =>
      run(async () => {
        if (planId) beginPlan(db, planId);
      }, 'We couldn’t start this plan. Please try again.'),
    [planId, run],
  );

  const pause = useCallback(
    () => run(async () => (progress ? pausePlanWithReminder(db, progress) : undefined), 'We couldn’t pause this plan. Please try again.'),
    [progress, run],
  );

  const resume = useCallback(
    () =>
      run(async () => {
        if (!progress) return;
        const result = await resumePlanWithReminder(db, progress);
        return result ? (REMINDER_MESSAGES[result.status] ?? null) : null;
      }, 'We couldn’t resume this plan. Please try again.'),
    [progress, run],
  );

  const stop = useCallback(
    () => run(async () => (progress ? stopPlanWithReminder(db, progress) : undefined), 'We couldn’t stop this plan. Please try again.'),
    [progress, run],
  );

  const toggleDay = useCallback(
    (day: number) =>
      run(async () => {
        if (!progress || !item) return;
        if (item.completedDays.includes(day)) await markDayIncomplete(db, progress, day);
        else await markDayComplete(db, progress, day);
      }, 'We couldn’t update this day. Please try again.'),
    [item, progress, run],
  );

  const setReminder = useCallback(
    (time: string | null) =>
      run(async () => {
        if (!progress) return;
        const result = await updatePlanReminder(db, progress, time);
        return result ? (REMINDER_MESSAGES[result.status] ?? null) : null;
      }, 'We couldn’t update the reminder. Please try again.'),
    [progress, run],
  );

  return { isBusy, message, start, pause, resume, stop, toggleDay, setReminder };
}
