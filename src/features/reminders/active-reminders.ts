/**
 * Read-only list of reminders the user has set across features (plans, prayers, action items),
 * shown in Settings › Reminders. Prayer/action titles are shown in-app only, never in notifications.
 */
import { and, asc, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm';

import { actionItems, planProgress, prayerEntries } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { getPlan } from '@/features/plans/catalog';

export type ActiveReminderKind = 'plan' | 'prayer' | 'action';

export type ReminderSchedule = { type: 'daily'; time: string } | { type: 'once'; at: string };

export interface ActiveReminder {
  kind: ActiveReminderKind;
  id: string;
  title: string;
  schedule: ReminderSchedule;
  href: string;
}

export interface ActiveReminders {
  plans: ActiveReminder[];
  prayers: ActiveReminder[];
  actions: ActiveReminder[];
}

/** Tables this list depends on (for live refresh). */
export const ACTIVE_REMINDER_TABLES = ['plan_progress', 'prayer_entries', 'action_items'] as const;

function listPlanReminders(db: AppDatabase): ActiveReminder[] {
  const rows = db
    .select({ id: planProgress.id, planId: planProgress.planId, reminderTime: planProgress.reminderTime })
    .from(planProgress)
    .where(and(isNull(planProgress.deletedAt), eq(planProgress.status, 'active'), isNotNull(planProgress.reminderTime)))
    .orderBy(asc(planProgress.reminderTime))
    .all();
  return rows.flatMap((row) => {
    const plan = getPlan(row.planId);
    if (!plan || !row.reminderTime) return [];
    return [{ kind: 'plan' as const, id: row.id, title: plan.title, schedule: { type: 'daily' as const, time: row.reminderTime }, href: `/plans/${plan.id}` }];
  });
}

function listPrayerReminders(db: AppDatabase, nowIso: string): ActiveReminder[] {
  const rows = db
    .select({ id: prayerEntries.id, title: prayerEntries.title, reminderAt: prayerEntries.reminderAt })
    .from(prayerEntries)
    .where(
      and(
        isNull(prayerEntries.deletedAt),
        inArray(prayerEntries.status, ['praying', 'ongoing']),
        isNotNull(prayerEntries.reminderNotificationId),
        gt(prayerEntries.reminderAt, nowIso),
      ),
    )
    .orderBy(asc(prayerEntries.reminderAt))
    .all();
  return rows.map((row) => ({
    kind: 'prayer' as const,
    id: row.id,
    title: row.title || 'Prayer',
    schedule: { type: 'once' as const, at: row.reminderAt ?? nowIso },
    href: `/prayers/${row.id}`,
  }));
}

function listActionReminders(db: AppDatabase, nowIso: string): ActiveReminder[] {
  const rows = db
    .select({ id: actionItems.id, title: actionItems.title, reminderAt: actionItems.reminderAt })
    .from(actionItems)
    .where(
      and(
        isNull(actionItems.deletedAt),
        isNull(actionItems.completedAt),
        isNotNull(actionItems.reminderNotificationId),
        gt(actionItems.reminderAt, nowIso),
      ),
    )
    .orderBy(asc(actionItems.reminderAt))
    .all();
  return rows.map((row) => ({
    kind: 'action' as const,
    id: row.id,
    title: row.title || 'Action item',
    schedule: { type: 'once' as const, at: row.reminderAt ?? nowIso },
    href: '/library/actions',
  }));
}

export function listActiveReminders(db: AppDatabase, now: Date = new Date()): ActiveReminders {
  const nowIso = now.toISOString();
  return {
    plans: listPlanReminders(db),
    prayers: listPrayerReminders(db, nowIso),
    actions: listActionReminders(db, nowIso),
  };
}
