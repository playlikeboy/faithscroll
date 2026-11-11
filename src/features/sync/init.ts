/**
 * CONTRACT STUB — owned by the backend-auth agent.
 * Start background sync (outbox push / pull) and Supabase auth auto-refresh tied to AppState.
 * Must be a no-op when Supabase is not configured or the user is signed out.
 * Returns a cleanup function.
 */
export function initSync(): () => void {
  return () => undefined;
}
