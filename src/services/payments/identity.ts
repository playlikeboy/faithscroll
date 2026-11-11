import Purchases from 'react-native-purchases';

import { logger } from '@/lib/logger';
import { getSupabase } from '@/services/supabase/client';

import { publishCustomerInfo } from './entitlement-store';
import { isPaymentsConfigured } from './runtime';

/** `undefined` = no identity requested yet in this process. */
let requestedUserId: string | null | undefined;
let queue: Promise<void> = Promise.resolve();

async function applyIdentity(userId: string | null): Promise<void> {
  if (userId) {
    const { customerInfo } = await Purchases.logIn(userId);
    publishCustomerInfo(customerInfo);
    return;
  }
  // Logging out an anonymous RevenueCat user is an error; nothing to do in that case.
  if (await Purchases.isAnonymous()) return;
  publishCustomerInfo(await Purchases.logOut());
}

/**
 * Point RevenueCat at the signed-in Supabase user (app user id = Supabase uid), or back to an
 * anonymous id on sign-out. Idempotent and serialised, so it is safe to call from many places.
 */
export function syncPurchasesUser(userId: string | null): Promise<void> {
  if (!isPaymentsConfigured() || userId === requestedUserId) return queue;
  requestedUserId = userId;
  queue = queue
    .then(() => applyIdentity(userId))
    .catch((error: unknown) => {
      // Allow a later call to retry the same identity.
      if (requestedUserId === userId) requestedUserId = undefined;
      logger.error('Could not update the purchases account', error, { signedIn: userId !== null });
    });
  return queue;
}

/** Resolves once any in-flight identity change has finished (purchases wait for this). */
export function waitForPurchasesIdentity(): Promise<void> {
  return queue;
}

/**
 * Follow Supabase auth changes for the life of the app. Returns an unsubscribe function.
 * No-op when cloud features aren't configured.
 */
export function watchSupabaseIdentity(): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    void syncPurchasesUser(session?.user.id ?? null);
  });
  return () => data.subscription.unsubscribe();
}

/** Test helper: forget the requested identity between tests. */
export function resetPurchasesIdentityForTests(): void {
  requestedUserId = undefined;
  queue = Promise.resolve();
}
