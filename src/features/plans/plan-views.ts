import type { AppDatabase } from '@/db/types';

import { getPlan, READING_PLANS } from './catalog';
import {
  getCurrentProgress,
  listCompletedDays,
  listCompletedDaysByProgress,
  listCurrentProgress,
  summarizeProgress,
  type PlanProgressRow,
  type PlanProgressSummary,
} from './repository';
import type { ReadingPlan } from './types';

export interface PlanWithProgress {
  plan: ReadingPlan;
  progress: PlanProgressRow | undefined;
  completedDays: number[];
  summary: PlanProgressSummary;
}

/** Every plan in the catalog with the user's progress (started plans first, catalog order otherwise). */
export function listPlansWithProgress(db: AppDatabase): PlanWithProgress[] {
  const progressRows = listCurrentProgress(db);
  const byPlan = new Map(progressRows.map((row) => [row.planId, row]));
  const completions = listCompletedDaysByProgress(db, progressRows.map((row) => row.id));
  const items = READING_PLANS.map((plan) => {
    const progress = byPlan.get(plan.id);
    const completedDays = progress ? (completions.get(progress.id) ?? []) : [];
    return { plan, progress, completedDays, summary: summarizeProgress(plan.days.length, completedDays) };
  });
  return [...items.filter((item) => item.progress), ...items.filter((item) => !item.progress)];
}

export function getPlanWithProgress(db: AppDatabase, planId: string): PlanWithProgress | null {
  const plan = getPlan(planId);
  if (!plan) return null;
  const progress = getCurrentProgress(db, planId);
  const completedDays = progress ? listCompletedDays(db, progress.id) : [];
  return { plan, progress, completedDays, summary: summarizeProgress(plan.days.length, completedDays) };
}

/** "Day 5 of 21", "Paused · Day 5 of 21", "Finished". Never mentions missed days. */
export function describePlanStatus({ progress, summary }: Pick<PlanWithProgress, 'progress' | 'summary'>): string | null {
  if (!progress) return null;
  if (progress.status === 'completed' || summary.isComplete) return 'Finished';
  const day = `Day ${summary.currentDay ?? summary.totalDays} of ${summary.totalDays}`;
  return progress.status === 'paused' ? `Paused · ${day}` : day;
}
