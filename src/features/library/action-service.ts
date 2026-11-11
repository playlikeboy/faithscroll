/** Action item operations that also touch notifications. Reminder text never includes the action itself. */
import type { AppDatabase } from '@/db/types';
import { cancelReminder, scheduleOneTimeReminderWithResult, type ScheduleResult } from '@/features/reminders/scheduler';

import { deleteActionItem, setActionItemCompleted, setActionItemReminder, type ActionItemRow } from './action-items';

export const ACTION_REMINDER_COPY = {
  title: 'A gentle reminder',
  body: 'Something you wanted to live out is waiting for you.',
  url: '/library/actions',
} as const;

/** Set (date) or clear (null) a one-time reminder for an action. */
export async function setActionReminder(db: AppDatabase, item: ActionItemRow, date: Date | null): Promise<ScheduleResult | null> {
  if (item.reminderNotificationId) await cancelReminder(item.reminderNotificationId);
  if (!date) {
    setActionItemReminder(db, item.id, null, null);
    return null;
  }
  const result = await scheduleOneTimeReminderWithResult({ ...ACTION_REMINDER_COPY, date });
  if (result.status === 'scheduled') setActionItemReminder(db, item.id, date.toISOString(), result.id);
  else setActionItemReminder(db, item.id, null, null);
  return result;
}

/** Completing an action cancels its pending reminder. */
export async function setActionCompleted(db: AppDatabase, item: ActionItemRow, completed: boolean): Promise<void> {
  setActionItemCompleted(db, item.id, completed);
  if (completed && item.reminderNotificationId) {
    await cancelReminder(item.reminderNotificationId);
    setActionItemReminder(db, item.id, item.reminderAt, null);
  }
}

export async function removeActionItem(db: AppDatabase, item: ActionItemRow): Promise<void> {
  if (item.reminderNotificationId) await cancelReminder(item.reminderNotificationId);
  deleteActionItem(db, item.id);
}
