import { sql } from 'drizzle-orm';
import { AppState, type AppStateStatus } from 'react-native';

import { db as mockedDb } from '@/db/client';
import { enqueueChange } from '@/db/mutations';
import { resetSessionStoreForTests } from '@/features/auth/session-store';
import { FREE_SNAPSHOT } from '@/services/payments/entitlement';
import { useEntitlementStore } from '@/services/payments/entitlement-store';

import { initSync, LOCAL_CHANGE_DELAY_MS, syncNow } from '../init';
import { useSyncStore } from '../store';
import { createFakeSupabase, type FakeSupabaseServer } from '../testing/fake-supabase';

const USER = '44444444-4444-4444-8444-444444444444';

jest.mock('@/db/client', () => {
  const { createTestDb } = jest.requireActual('@/db/testing/create-test-db');
  return { db: createTestDb() };
});

let mockDbListener: ((event: { tableName: string }) => void) | null = null;
jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: jest.fn((listener: (event: { tableName: string }) => void) => {
    mockDbListener = listener;
    return { remove: jest.fn(() => (mockDbListener = null)) };
  }),
}));

let mockClient: Record<string, unknown> | null = null;
jest.mock('@/services/supabase/client', () => ({
  getSupabase: () => mockClient,
  isSupabaseConfigured: () => mockClient !== null,
}));

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
  getErrorMessage: (error: unknown) => String(error),
}));

let appStateHandler: ((state: AppStateStatus) => void) | null = null;
const auth = {
  startAutoRefresh: jest.fn(async () => undefined),
  stopAutoRefresh: jest.fn(async () => undefined),
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  getSession: jest.fn(),
};
let server: FakeSupabaseServer;

function configure(options: { signedIn: boolean; plus: boolean; enabled: boolean }) {
  const fake = createFakeSupabase(USER);
  server = fake.server;
  mockClient = { ...(fake.client as unknown as Record<string, unknown>), auth };
  auth.getSession.mockResolvedValue({
    data: { session: options.signedIn ? { user: { id: USER } } : null },
    error: null,
  });
  useEntitlementStore.setState({
    status: options.plus ? 'ready' : 'unavailable',
    snapshot: { ...FREE_SNAPSHOT, isPlus: options.plus, expiresAt: null },
  });
  useSyncStore.setState({ cloudSyncEnabled: options.enabled, entitlementActive: false, phase: 'idle', problem: null });
}

const flush = () => jest.advanceTimersByTimeAsync(0);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockClient = null;
  resetSessionStoreForTests();
  mockedDb.run(sql`DELETE FROM outbox`);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

test('is a no-op when Supabase is not configured', async () => {
  const stop = initSync();
  await syncNow();
  stop();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(mockDbListener).toBeNull();
});

test('refreshes tokens in the foreground only, and never syncs when signed out', async () => {
  configure({ signedIn: false, plus: true, enabled: true });
  const stop = initSync();
  await flush();

  expect(auth.startAutoRefresh).toHaveBeenCalled();
  expect(server.requests).toHaveLength(0);

  appStateHandler?.('background');
  expect(auth.stopAutoRefresh).toHaveBeenCalled();
  stop();
});

test('does not sync without Plus even when the user enabled it', async () => {
  configure({ signedIn: true, plus: false, enabled: true });
  const stop = initSync();
  await flush();

  expect(useSyncStore.getState().entitlementActive).toBe(false);
  expect(server.requests).toHaveLength(0);
  stop();
});

test('syncs when signed in, Plus and enabled; uploads shortly after local edits', async () => {
  configure({ signedIn: true, plus: true, enabled: true });
  const stop = initSync();
  await flush();
  await flush();
  expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
  const before = server.requests.length;
  expect(before).toBeGreaterThan(0);

  const id = 'cccccccc-0000-4000-8000-000000000001';
  mockedDb.run(sql`INSERT INTO journal_entries (id, title, content, entry_type, entry_date, created_at, updated_at, version)
                   VALUES (${id}, '', 'hello', 'personal', '2026-11-11', '2026-11-11T00:00:00.000Z', '2026-11-11T00:00:00.000Z', 1)`);
  enqueueChange(mockedDb, 'journal_entry', id);
  mockDbListener?.({ tableName: 'outbox' });
  await jest.advanceTimersByTimeAsync(LOCAL_CHANGE_DELAY_MS);
  await flush();

  expect(server.get('journal_entries', id)).toMatchObject({ content: 'hello' });
  stop();
  expect(mockDbListener).toBeNull();
});

test('starts syncing as soon as the user turns sync on', async () => {
  configure({ signedIn: true, plus: true, enabled: false });
  const stop = initSync();
  await flush();
  expect(server.requests).toHaveLength(0);

  useSyncStore.getState().setCloudSyncEnabled(true);
  await flush();
  await flush();

  expect(server.requests.length).toBeGreaterThan(0);
  stop();
});
