/**
 * Reading plan progress (local SQLite). Plans are self-paced: the "current day" is the first day
 * not yet marked complete, so there is no notion of a missed day or a streak.
 */
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';

import { enqueueChange, touch } from '@/db/mutations';
import { planDayCompletions, planProgress } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { newId } from '@/lib/ids';
import { nowIso } from '@/lib/time';

export type PlanProgressRow = typeof planProgress.$inferSelect;

/** Tables plan screens depend on (for live refresh). */
export const PLAN_TABLES = ['plan_progress', 'plan_day_completions'] as const;

const notAbandoned = () => and(isNull(planProgress.deletedAt), ne(planProgress.status, 'abandoned'));

/** The plan's current (not stopped) progress row, if the user has started it. */
export function getCurrentProgress(db: AppDatabase, planId: string): PlanProgressRow | undefined {
  return db
    .select()
    .from(planProgress)
    .where(and(eq(planProgress.planId, planId), notAbandoned()))
    .orderBy(desc(planProgress.startedAt))
    .limit(1)
    .get();
}

/** Every started (active, paused or completed) plan, most recent first, one row per plan. */
export function listCurrentProgress(db: AppDatabase): PlanProgressRow[] {
  const rows = db.select().from(planProgress).where(notAbandoned()).orderBy(desc(planProgress.startedAt)).all();
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.planId)) return false;
    seen.add(row.planId);
    return true;
  });
}

export function getProgress(db: AppDatabase, progressId: string): PlanProgressRow | undefined {
  return db.select().from(planProgress).where(and(eq(planProgress.id, progressId), isNull(planProgress.deletedAt))).get();
}

/** Start a plan, or return the existing progress if it is already started. */
export function startPlan(db: AppDatabase, planId: string): string {
  const existing = getCurrentProgress(db, planId);
  if (existing) return existing.id;
  const id = newId();
  db.transaction((tx) => {
    tx.insert(planProgress).values({ id, planId, status: 'active', startedAt: nowIso() }).run();
    enqueueChange(tx, 'plan_progress', id);
  });
  return id;
}

function updateProgress(db: AppDatabase, progressId: string, changes: Partial<PlanProgressRow>): void {
  db.transaction((tx) => {
    tx.update(planProgress)
      .set({ ...changes, ...touch(planProgress.version) })
      .where(eq(planProgress.id, progressId))
      .run();
    enqueueChange(tx, 'plan_progress', progressId);
  });
}

export function pausePlan(db: AppDatabase, progressId: string): void {
  updateProgress(db, progressId, { status: 'paused', pausedAt: nowIso() });
}

export function resumePlan(db: AppDatabase, progressId: string): void {
  updateProgress(db, progressId, { status: 'active', pausedAt: null });
}

/** Stop a plan. Its history is kept; starting the plan again begins a fresh progress row. */
export function stopPlan(db: AppDatabase, progressId: string): void {
  updateProgress(db, progressId, { status: 'abandoned', reminderTime: null, reminderNotificationId: null });
}

export function setPlanReminder(
  db: AppDatabase,
  progressId: string,
  reminderTime: string | null,
  reminderNotificationId: string | null,
): void {
  updateProgress(db, progressId, { reminderTime, reminderNotificationId });
}

export function listCompletedDays(db: AppDatabase, progressId: string): number[] {
  return db
    .select({ day: planDayCompletions.day })
    .from(planDayCompletions)
    .where(eq(planDayCompletions.planProgressId, progressId))
    .orderBy(asc(planDayCompletions.day))
    .all()
    .map((row) => row.day);
}

/** Completed days for several progress rows at once (plan list screen). */
export function listCompletedDaysByProgress(db: AppDatabase, progressIds: readonly string[]): Map<string, number[]> {
  const result = new Map<string, number[]>(progressIds.map((id) => [id, []]));
  if (progressIds.length === 0) return result;
  const rows = db
    .select({ progressId: planDayCompletions.planProgressId, day: planDayCompletions.day })
    .from(planDayCompletions)
    .where(inArray(planDayCompletions.planProgressId, [...progressIds]))
    .orderBy(asc(planDayCompletions.day))
    .all();
  for (const row of rows) result.set(row.progressId, [...(result.get(row.progressId) ?? []), row.day]);
  return result;
}

/**
 * Mark a day read. When every day is read the plan becomes "completed".
 * Returns whether this completion finished the plan.
 */
export function completePlanDay(db: AppDatabase, progressId: string, day: number, totalDays: number): { planCompleted: boolean } {
  if (!Number.isInteger(day) || day < 1 || day > totalDays) throw new Error(`Day ${day} is outside this plan`);
  let planCompleted = false;
  db.transaction((tx) => {
    tx.insert(planDayCompletions)
      .values({ id: newId(), planProgressId: progressId, day, completedAt: nowIso() })
      .onConflictDoNothing()
      .run();
    const done = listCompletedDays(tx, progressId).length;
    const progress = getProgress(tx, progressId);
    if (done >= totalDays && progress && progress.status !== 'completed') {
      planCompleted = true;
      tx.update(planProgress)
        .set({ status: 'completed', completedAt: nowIso(), pausedAt: null, ...touch(planProgress.version) })
        .where(eq(planProgress.id, progressId))
        .run();
    } else {
      tx.update(planProgress).set(touch(planProgress.version)).where(eq(planProgress.id, progressId)).run();
    }
    enqueueChange(tx, 'plan_progress', progressId);
  });
  return { planCompleted };
}

/** Undo a day. A completed plan becomes active again so the user can keep reading. */
export function uncompletePlanDay(db: AppDatabase, progressId: string, day: number): void {
  db.transaction((tx) => {
    tx.delete(planDayCompletions)
      .where(and(eq(planDayCompletions.planProgressId, progressId), eq(planDayCompletions.day, day)))
      .run();
    const progress = getProgress(tx, progressId);
    const reopen = progress?.status === 'completed' ? { status: 'active' as const, completedAt: null } : {};
    tx.update(planProgress)
      .set({ ...reopen, ...touch(planProgress.version) })
      .where(eq(planProgress.id, progressId))
      .run();
    enqueueChange(tx, 'plan_progress', progressId);
  });
}

export interface PlanProgressSummary {
  completedCount: number;
  totalDays: number;
  /** First day not yet read (self-paced), or null when every day is read. */
  currentDay: number | null;
  isComplete: boolean;
}

export function summarizeProgress(totalDays: number, completedDays: readonly number[]): PlanProgressSummary {
  const done = new Set(completedDays.filter((day) => day >= 1 && day <= totalDays));
  let currentDay: number | null = null;
  for (let day = 1; day <= totalDays; day += 1) {
    if (!done.has(day)) {
      currentDay = day;
      break;
    }
  }
  return { completedCount: done.size, totalDays, currentDay, isComplete: currentDay === null };
}
