/**
 * CONTRACT STUB — owned by the backend-auth agent (implemented).
 * Current Supabase session. Signed-out (`session: null`, `isLoading: false`) when Supabase isn't
 * configured, so every caller can treat "not configured" like "signed out".
 */
import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo } from 'react';

import { startSessionListener, useSessionStore } from './session-store';

export interface SessionState {
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
}

export function useSession(): SessionState {
  useEffect(() => {
    startSessionListener();
  }, []);
  const session = useSessionStore((state) => state.session);
  const isLoading = useSessionStore((state) => state.isLoading);
  return useMemo(() => ({ session, userId: session?.user.id ?? null, isLoading }), [session, isLoading]);
}
