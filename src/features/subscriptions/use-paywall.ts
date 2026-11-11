import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { track } from '@/services/monitoring/analytics';
import type { PlanOption } from '@/services/payments/offerings';
import { isSupabaseConfigured } from '@/services/supabase/client';

import { billingDisclosure, ctaLabel, normalizePaywallSource } from './plan-content';
import { useSubscriptionStatus, type SubscriptionStatus } from './use-entitlements';
import { usePaymentsIdentitySync } from './use-payments-identity';
import { usePlanOptions } from './use-plan-options';
import { usePurchaseFlow, type PurchaseFlow } from './use-purchase-flow';

export type PlansState =
  | { kind: 'unavailable' }
  | { kind: 'loading' }
  | { kind: 'error'; retry: () => void }
  | { kind: 'empty'; retry: () => void }
  | { kind: 'ready'; options: PlanOption[] };

export interface PaywallModel {
  subscription: SubscriptionStatus;
  plans: PlansState;
  selected: PlanOption | null;
  select: (id: string) => void;
  /** Plus is account-based (AI + sync run on the server), so an account is needed to subscribe. */
  requiresSignIn: boolean;
  cta: string | null;
  disclosure: string | null;
  flow: PurchaseFlow;
  buySelected: () => Promise<boolean>;
}

/** All paywall logic; the route only renders. */
export function usePaywall(rawSource: unknown): PaywallModel {
  const source = normalizePaywallSource(rawSource);
  const { userId, isSessionLoading } = usePaymentsIdentitySync();
  const subscription = useSubscriptionStatus();
  const query = usePlanOptions(subscription.isAvailable);
  const flow = usePurchaseFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track({ name: 'paywall_viewed', source });
  }, [source]);

  const options = query.data ?? [];
  const selected = options.find((option) => option.id === selectedId) ?? options[0] ?? null;
  const retry = () => void query.refetch();

  let plans: PlansState;
  if (!subscription.isAvailable) plans = { kind: 'unavailable' };
  else if (query.isPending) plans = { kind: 'loading' };
  else if (query.isError) plans = { kind: 'error', retry };
  else if (options.length === 0) plans = { kind: 'empty', retry };
  else plans = { kind: 'ready', options };

  const platformStore = Platform.OS === 'android' ? 'Google Play' : 'App Store';

  return {
    subscription,
    plans,
    selected,
    select: setSelectedId,
    requiresSignIn: isSupabaseConfigured() && !isSessionLoading && userId === null,
    cta: selected ? ctaLabel(selected) : null,
    disclosure: selected ? billingDisclosure(selected, platformStore) : null,
    flow,
    buySelected: async () => (selected ? flow.purchase(selected) : false),
  };
}
