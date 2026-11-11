/**
 * CONTRACT STUB — owned by the backend-auth agent (implemented).
 * Supabase client. Returns null when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 * are not configured, so the app keeps working fully offline / signed-out.
 *
 * - One client per process (singleton).
 * - Sessions persist in the Keychain/Keystore through a chunked expo-secure-store adapter.
 * - Token auto-refresh is started/stopped with AppState by `initSync()` (src/features/sync/init.ts).
 */
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

import { parseSupabaseConfig, readSupabaseEnv, type SupabaseConfig } from './config';
import type { Database } from './database.types';
import { createChunkedSecureStorage } from './secure-storage';

export type TypedSupabaseClient = SupabaseClient<Database>;

/** `undefined` = not created yet; `null` = not configured (or creation failed). */
let client: TypedSupabaseClient | null | undefined;

export function getSupabaseConfig(): SupabaseConfig | null {
  return parseSupabaseConfig(readSupabaseEnv());
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

function createAppClient(config: SupabaseConfig): TypedSupabaseClient {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      // Web (not a release target) falls back to the default browser storage.
      storage: Platform.OS === 'web' ? undefined : createChunkedSecureStorage(),
      persistSession: true,
      autoRefreshToken: true,
      // Native auth only (Apple id token + email one-time code): no URL-based sessions.
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
}

/** Typed client for the backend-auth tables (see database.types.ts). */
export function getTypedSupabase(): TypedSupabaseClient | null {
  if (client !== undefined) return client;
  const config = getSupabaseConfig();
  if (!config) {
    client = null;
    return client;
  }
  try {
    client = createAppClient(config);
  } catch (error) {
    logger.error('Supabase client could not be created', error);
    client = null;
  }
  return client;
}

/** Untyped client for any table/function (AI, subscriptions, storage). */
export function getSupabase(): SupabaseClient | null {
  return getTypedSupabase();
}

/** Test helper: forget the singleton so the next call re-reads the environment. */
export function resetSupabaseClientForTests(): void {
  client = undefined;
}
