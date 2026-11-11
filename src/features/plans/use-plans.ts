import { useCallback } from 'react';

import { db } from '@/db/client';
import { useLiveData, type LiveData } from '@/features/library/use-live-data';

import { getPlanWithProgress, listPlansWithProgress, type PlanWithProgress } from './plan-views';
import { PLAN_TABLES } from './repository';

export function usePlanList(): LiveData<PlanWithProgress[]> {
  const read = useCallback(() => listPlansWithProgress(db), []);
  return useLiveData(read, PLAN_TABLES);
}

export function usePlan(planId: string): LiveData<PlanWithProgress | null> {
  const read = useCallback(() => getPlanWithProgress(db, planId), [planId]);
  return useLiveData(read, PLAN_TABLES);
}
