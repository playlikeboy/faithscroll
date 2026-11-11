import { eq } from 'drizzle-orm';

import { outbox } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';

import {
  completePlanDay,
  getCurrentProgress,
  getProgress,
  listCompletedDays,
  listCompletedDaysByProgress,
  listCurrentProgress,
  pausePlan,
  resumePlan,
  setPlanReminder,
  startPlan,
  stopPlan,
  summarizeProgress,
  uncompletePlanDay,
} from '../repository';

function outboxFor(db: AppDatabase, id: string) {
  return db.select().from(outbox).where(eq(outbox.entityId, id)).all();
}

describe('plan progress repository', () => {
  let db: AppDatabase;
  beforeEach(() => {
    db = createTestDb();
  });

  it('starts a plan once and enqueues it for sync', () => {
    const id = startPlan(db, 'john-21');
    expect(startPlan(db, 'john-21')).toBe(id);
    expect(getCurrentProgress(db, 'john-21')).toMatchObject({ id, planId: 'john-21', status: 'active', version: 1 });
    expect(outboxFor(db, id)).toEqual([expect.objectContaining({ entityType: 'plan_progress', operation: 'upsert' })]);
  });

  it('pauses, resumes and stops', () => {
    const id = startPlan(db, 'psalms-30');
    pausePlan(db, id);
    expect(getProgress(db, id)).toMatchObject({ status: 'paused', version: 2 });
    expect(getProgress(db, id)?.pausedAt).toBeTruthy();
    resumePlan(db, id);
    expect(getProgress(db, id)).toMatchObject({ status: 'active', pausedAt: null, version: 3 });
    setPlanReminder(db, id, '07:00', 'n1');
    stopPlan(db, id);
    expect(getProgress(db, id)).toMatchObject({ status: 'abandoned', reminderTime: null, reminderNotificationId: null });
    expect(getCurrentProgress(db, 'psalms-30')).toBeUndefined();
    expect(outboxFor(db, id).length).toBeGreaterThanOrEqual(5);
  });

  it('starts a fresh progress row after stopping', () => {
    const first = startPlan(db, 'hope-7');
    completePlanDay(db, first, 1, 7);
    stopPlan(db, first);
    const second = startPlan(db, 'hope-7');
    expect(second).not.toBe(first);
    expect(listCompletedDays(db, second)).toEqual([]);
    expect(listCurrentProgress(db).map((row) => row.id)).toEqual([second]);
  });

  it('records day completions idempotently and completes the plan on the last day', () => {
    const id = startPlan(db, 'gratitude-7');
    for (const day of [1, 2, 3, 4, 5, 6]) expect(completePlanDay(db, id, day, 7)).toEqual({ planCompleted: false });
    expect(completePlanDay(db, id, 6, 7)).toEqual({ planCompleted: false });
    expect(listCompletedDays(db, id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(completePlanDay(db, id, 7, 7)).toEqual({ planCompleted: true });
    expect(getProgress(db, id)).toMatchObject({ status: 'completed' });
    expect(getProgress(db, id)?.completedAt).toBeTruthy();
    expect(completePlanDay(db, id, 7, 7)).toEqual({ planCompleted: false });
  });

  it('rejects days outside the plan', () => {
    const id = startPlan(db, 'gratitude-7');
    expect(() => completePlanDay(db, id, 0, 7)).toThrow();
    expect(() => completePlanDay(db, id, 8, 7)).toThrow();
  });

  it('un-completing a day reopens a finished plan', () => {
    const id = startPlan(db, 'hope-7');
    for (let day = 1; day <= 7; day += 1) completePlanDay(db, id, day, 7);
    uncompletePlanDay(db, id, 3);
    expect(listCompletedDays(db, id)).toEqual([1, 2, 4, 5, 6, 7]);
    expect(getProgress(db, id)).toMatchObject({ status: 'active', completedAt: null });
  });

  it('lists the current progress of every started plan with completions', () => {
    const john = startPlan(db, 'john-21');
    const psalms = startPlan(db, 'psalms-30');
    completePlanDay(db, john, 1, 21);
    completePlanDay(db, john, 2, 21);
    expect(listCurrentProgress(db).map((row) => row.planId).sort()).toEqual(['john-21', 'psalms-30']);
    const byProgress = listCompletedDaysByProgress(db, [john, psalms]);
    expect(byProgress.get(john)).toEqual([1, 2]);
    expect(byProgress.get(psalms)).toEqual([]);
    expect(listCompletedDaysByProgress(db, []).size).toBe(0);
  });
});

describe('summarizeProgress', () => {
  it('is self-paced: the current day is the first unread day', () => {
    expect(summarizeProgress(21, [])).toEqual({ completedCount: 0, totalDays: 21, currentDay: 1, isComplete: false });
    expect(summarizeProgress(21, [1, 2, 3, 4])).toMatchObject({ completedCount: 4, currentDay: 5 });
    expect(summarizeProgress(21, [1, 2, 4])).toMatchObject({ completedCount: 3, currentDay: 3 });
    expect(summarizeProgress(3, [1, 2, 3, 9])).toEqual({ completedCount: 3, totalDays: 3, currentDay: null, isComplete: true });
  });
});
