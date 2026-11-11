import { createTestDb } from '@/db/testing/create-test-db';

import { describePlanStatus, getPlanWithProgress, listPlansWithProgress } from '../plan-views';
import { completePlanDay, pausePlan, startPlan } from '../repository';

describe('plan views', () => {
  it('lists started plans first with their progress', () => {
    const db = createTestDb();
    const id = startPlan(db, 'hope-7');
    completePlanDay(db, id, 1, 7);
    const items = listPlansWithProgress(db);
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({ plan: { id: 'hope-7' }, completedDays: [1], summary: { currentDay: 2, completedCount: 1 } });
    expect(items.slice(1).every((item) => item.progress === undefined)).toBe(true);
  });

  it('returns one plan with progress, or null for an unknown plan', () => {
    const db = createTestDb();
    expect(getPlanWithProgress(db, 'nope')).toBeNull();
    expect(getPlanWithProgress(db, 'john-21')).toMatchObject({ progress: undefined, completedDays: [], summary: { currentDay: 1 } });
  });

  it('describes status as "Day N of M" without missed-day language', () => {
    const db = createTestDb();
    const id = startPlan(db, 'john-21');
    for (const day of [1, 2, 3, 4]) completePlanDay(db, id, day, 21);
    const active = getPlanWithProgress(db, 'john-21');
    expect(active && describePlanStatus(active)).toBe('Day 5 of 21');
    pausePlan(db, id);
    const paused = getPlanWithProgress(db, 'john-21');
    expect(paused && describePlanStatus(paused)).toBe('Paused · Day 5 of 21');
    for (let day = 5; day <= 21; day += 1) completePlanDay(db, id, day, 21);
    const finished = getPlanWithProgress(db, 'john-21');
    expect(finished && describePlanStatus(finished)).toBe('Finished');
    const notStarted = getPlanWithProgress(db, 'psalms-30');
    expect(notStarted && describePlanStatus(notStarted)).toBeNull();
  });
});
