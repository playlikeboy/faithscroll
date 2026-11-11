import { parseSupabaseConfig } from '@/services/supabase/config';

const mockCreateClient = jest.fn((_url: string, _key: string, _options: unknown) => ({ auth: {} }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string, options: unknown) => mockCreateClient(url, key, options),
  processLock: jest.fn(),
}));

describe('parseSupabaseConfig', () => {
  test('accepts an https project URL and key, trimming whitespace and trailing slashes', () => {
    expect(parseSupabaseConfig({ url: ' https://abc.supabase.co/ ', anonKey: ' key ' })).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'key',
    });
  });

  test('returns null when a value is missing', () => {
    expect(parseSupabaseConfig({ url: 'https://abc.supabase.co' })).toBeNull();
    expect(parseSupabaseConfig({ anonKey: 'key' })).toBeNull();
    expect(parseSupabaseConfig({ url: '', anonKey: '' })).toBeNull();
  });

  test('rejects malformed and insecure remote URLs', () => {
    expect(parseSupabaseConfig({ url: 'not a url', anonKey: 'key' })).toBeNull();
    expect(parseSupabaseConfig({ url: 'http://abc.supabase.co', anonKey: 'key' })).toBeNull();
  });

  test('allows plain http only for a local development stack', () => {
    expect(parseSupabaseConfig({ url: 'http://127.0.0.1:54321', anonKey: 'key' })).not.toBeNull();
    expect(parseSupabaseConfig({ url: 'http://localhost:54321', anonKey: 'key' })).not.toBeNull();
  });
});

describe('getSupabase', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function load() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/services/supabase/client') as typeof import('@/services/supabase/client');
  }

  test('returns null and reports unconfigured when env vars are missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const { getSupabase, isSupabaseConfigured } = load();

    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabase()).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  test('creates one client with keychain persistence and no URL session detection', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
    const { getSupabase, isSupabaseConfigured } = load();

    const first = getSupabase();
    const second = getSupabase();

    expect(isSupabaseConfigured()).toBe(true);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    const [url, key, options] = mockCreateClient.mock.calls[0] as [string, string, { auth: Record<string, unknown> }];
    expect(url).toBe('https://abc.supabase.co');
    expect(key).toBe('public-anon-key');
    expect(options.auth).toEqual(
      expect.objectContaining({ persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }),
    );
    expect(options.auth.storage).toEqual(
      expect.objectContaining({ getItem: expect.any(Function), setItem: expect.any(Function), removeItem: expect.any(Function) }),
    );
  });

  test('returns null when client creation throws', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
    mockCreateClient.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { getSupabase } = load();

    expect(getSupabase()).toBeNull();
  });
});
