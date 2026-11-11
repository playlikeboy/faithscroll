/**
 * CONTRACT STUB — owned by the backend-auth agent.
 */
import type { Session } from '@supabase/supabase-js';

export interface SessionState {
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
}

export function useSession(): SessionState {
  return { session: null, userId: null, isLoading: false };
}
