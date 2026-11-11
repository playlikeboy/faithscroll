/**
 * Process-wide auth session state, fed by Supabase `onAuthStateChange`.
 * `useSession()` reads it in components; the sync engine reads it with `getSessionSnapshot()`.
 */
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { logger } from '@/lib/logger';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';

import { errorContext } from './errors';

export interface SessionStoreState {
  session: Session | null;
  isLoading: boolean;
}

export const useSessionStore = create<SessionStoreState>()(() => ({
  session: null,
  isLoading: isSupabaseConfigured(),
}));

let unsubscribe: (() => void) | null = null;

/**
 * Start following Supabase auth state (idempotent). Safe to call from many places; a no-op that
 * settles to "signed out" when Supabase isn't configured.
 */
export function startSessionListener(): void {
  if (unsubscribe) return;
  const supabase = getSupabase();
  if (!supabase) {
    useSessionStore.setState({ session: null, isLoading: false });
    unsubscribe = () => undefined;
    return;
  }

  useSessionStore.setState({ isLoading: true });
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    useSessionStore.setState({ session, isLoading: false });
  });
  unsubscribe = () => data.subscription.unsubscribe();

  supabase.auth
    .getSession()
    .then(({ data: result, error }) => {
      if (error) logger.warn('Stored session could not be restored', errorContext(error));
      // onAuthStateChange may already have delivered a newer session; only fill in if still loading.
      if (useSessionStore.getState().isLoading) {
        useSessionStore.setState({ session: result.session, isLoading: false });
      }
    })
    .catch((error: unknown) => {
      logger.error('Reading the stored session failed', error, errorContext(error));
      useSessionStore.setState({ isLoading: false });
    });
}

export function getSessionSnapshot(): SessionStoreState {
  return useSessionStore.getState();
}

/** Calls `listener` with the user id whenever it changes. Returns an unsubscribe function. */
export function subscribeToUserId(listener: (userId: string | null) => void): () => void {
  return useSessionStore.subscribe((state, previous) => {
    const next = state.session?.user.id ?? null;
    const before = previous.session?.user.id ?? null;
    if (next !== before) listener(next);
  });
}

/** Test helper. */
export function resetSessionStoreForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  useSessionStore.setState({ session: null, isLoading: isSupabaseConfigured() });
}
