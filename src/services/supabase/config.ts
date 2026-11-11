/**
 * Public Supabase configuration from `EXPO_PUBLIC_*` variables (inlined by Expo at build time,
 * so they must be read with literal dot access). Only the public anon/publishable key belongs
 * here — never the service-role key.
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface RawSupabaseEnv {
  url?: string;
  anonKey?: string;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:') return true;
    // Plain http is only acceptable for a local development stack.
    const local = ['localhost', '127.0.0.1', '10.0.2.2'].includes(parsed.hostname) || parsed.hostname.endsWith('.local');
    return parsed.protocol === 'http:' && local;
  } catch {
    return false;
  }
}

/** Validates raw values; returns null when anything is missing or malformed. */
export function parseSupabaseConfig(raw: RawSupabaseEnv): SupabaseConfig | null {
  const url = raw.url?.trim().replace(/\/+$/, '') ?? '';
  const anonKey = raw.anonKey?.trim() ?? '';
  if (!url || !anonKey || !isValidUrl(url)) return null;
  return { url, anonKey };
}

export function readSupabaseEnv(): RawSupabaseEnv {
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}
