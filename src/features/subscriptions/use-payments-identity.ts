import { useEffect } from 'react';

import { useSession } from '@/features/auth/use-session';
import { syncPurchasesUser } from '@/services/payments/identity';
import { isSupabaseConfigured } from '@/services/supabase/client';

export interface PaymentsIdentity {
  userId: string | null;
  isSessionLoading: boolean;
  /**
   * Plus is account-based (AI and sync run on the server, and the server only learns about
   * purchases made by signed-in users), so when cloud features are configured the user signs in
   * before buying or restoring. Without cloud configuration purchases work locally.
   */
  requiresSignIn: boolean;
}

/**
 * Keep RevenueCat's app user id equal to the signed-in Supabase user id, so purchases follow the
 * account across devices and reach the server (webhook → `subscriptions` table).
 * `initPayments` already follows Supabase auth events; this is a belt-and-braces sync used by
 * screens that sell or restore, so a purchase is never attributed to a stale identity.
 */
export function usePaymentsIdentitySync(): PaymentsIdentity {
  const { userId, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;
    void syncPurchasesUser(userId);
  }, [userId, isLoading]);

  return {
    userId,
    isSessionLoading: isLoading,
    requiresSignIn: isSupabaseConfigured() && !isLoading && userId === null,
  };
}
