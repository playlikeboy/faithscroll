import { useQuery } from '@tanstack/react-query';

import { loadPlanOptions, type PlanOption } from '@/services/payments/offerings';

export const PLAN_OPTIONS_QUERY_KEY = ['subscriptions', 'plan-options'] as const;

const FIVE_MINUTES = 5 * 60 * 1000;

/** Packages from the current RevenueCat offering, with localized prices. */
export function usePlanOptions(enabled: boolean) {
  return useQuery<PlanOption[]>({
    queryKey: PLAN_OPTIONS_QUERY_KEY,
    queryFn: loadPlanOptions,
    enabled,
    staleTime: FIVE_MINUTES,
    retry: 1,
  });
}
