/**
 * CONTRACT STUB — owned by the backend-auth agent.
 * Supabase client. Returns null when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 * are not configured, so the app keeps working fully offline / signed-out.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export function isSupabaseConfigured(): boolean {
  return false;
}

export function getSupabase(): SupabaseClient | null {
  return null;
}
