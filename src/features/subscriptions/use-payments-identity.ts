import { useEffect } from 'react';

import { useSession } from '@/features/auth/use-session';
import { syncPurchasesUser } from '@/services/payments/identity';

/**
 * Keep RevenueCat's app user id equal to the signed-in Supabase user id, so purchases follow the
 * account across devices and reach the server (webhook → `subscriptions` table).
 * `initPayments` already follows Supabase auth events; this is a belt-and-braces sync used by
 * screens that sell or restore, so a purchase is never attributed to a stale identity.
 */
export function usePaymentsIdentitySync(): { userId: string | null; isSessionLoading: boolean } {
  const { userId, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;
    void syncPurchasesUser(userId);
  }, [userId, isLoading]);

  return { userId, isSessionLoading: isLoading };
}
