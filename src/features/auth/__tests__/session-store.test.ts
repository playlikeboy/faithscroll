import { act, renderHook } from '@testing-library/react-native';

import {
  getSessionSnapshot,
  resetSessionStoreForTests,
  startSessionListener,
  subscribeToUserId,
  useSessionStore,
} from '../session-store';
import { useSession } from '../use-session';

type AuthCallback = (event: string, session: unknown) => void;

let authCallback: AuthCallback | null = null;
const unsubscribe = jest.fn();
const mockAuth = {
  onAuthStateChange: jest.fn((callback: AuthCallback) => {
    authCallback = callback;
    return { data: { subscription: { unsubscribe } } };
  }),
  getSession: jest.fn(),
};
let mockClient: unknown = null;

jest.mock('@/services/supabase/client', () => ({
  getSupabase: () => mockClient,
  isSupabaseConfigured: () => mockClient !== null,
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const session = (id: string) => ({ access_token: 'token', user: { id, email: `${id}@example.com` } });

beforeEach(() => {
  jest.clearAllMocks();
  authCallback = null;
  mockClient = { auth: mockAuth };
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  resetSessionStoreForTests();
});

test('settles to signed out when Supabase is not configured', () => {
  mockClient = null;
  resetSessionStoreForTests();

  startSessionListener();

  expect(getSessionSnapshot()).toEqual({ session: null, isLoading: false });
  expect(mockAuth.onAuthStateChange).not.toHaveBeenCalled();
});

test('restores the stored session and follows auth changes', async () => {
  mockAuth.getSession.mockResolvedValue({ data: { session: session('u1') }, error: null });

  startSessionListener();
  expect(getSessionSnapshot().isLoading).toBe(true);
  await flush();

  expect(getSessionSnapshot().session?.user.id).toBe('u1');
  expect(getSessionSnapshot().isLoading).toBe(false);

  authCallback?.('SIGNED_OUT', null);
  expect(getSessionSnapshot().session).toBeNull();
});

test('subscribes only once even when started repeatedly', () => {
  startSessionListener();
  startSessionListener();
  expect(mockAuth.onAuthStateChange).toHaveBeenCalledTimes(1);
});

test('does not let a late getSession overwrite a newer auth event', async () => {
  let resolveGetSession: (value: unknown) => void = () => undefined;
  mockAuth.getSession.mockReturnValue(new Promise((resolve) => (resolveGetSession = resolve)));

  startSessionListener();
  authCallback?.('SIGNED_IN', session('fresh'));
  resolveGetSession({ data: { session: null }, error: null });
  await flush();

  expect(getSessionSnapshot().session?.user.id).toBe('fresh');
});

test('notifies user id changes only', () => {
  const listener = jest.fn();
  const stop = subscribeToUserId(listener);

  useSessionStore.setState({ session: session('a') as never, isLoading: false });
  useSessionStore.setState({ session: session('a') as never, isLoading: false });
  useSessionStore.setState({ session: null, isLoading: false });
  stop();

  expect(listener.mock.calls).toEqual([['a'], [null]]);
});

test('useSession exposes the user id and starts the listener', async () => {
  mockAuth.getSession.mockResolvedValue({ data: { session: session('u9') }, error: null });

  const { result } = await renderHook(() => useSession());
  await act(async () => {
    await flush();
  });

  expect(mockAuth.onAuthStateChange).toHaveBeenCalled();
  expect(result.current.userId).toBe('u9');
  expect(result.current.isLoading).toBe(false);
});
