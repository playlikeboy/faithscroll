import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { createTestDb } from '@/db/testing/create-test-db';

import { AccountView } from '../components/account-view';
import { SignInView } from '../components/sign-in-view';
import { NOT_CONFIGURED_MESSAGE } from '../errors';
import { resetSessionStoreForTests, useSessionStore } from '../session-store';

const mockAuth = {
  onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
  signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
  verifyOtp: jest.fn(async () => ({ data: {}, error: null })),
  signOut: jest.fn(async () => ({ error: null })),
};
const mockInvoke = jest.fn(async () => ({ data: { ok: true }, error: null }));
let mockClient: unknown = null;

jest.mock('@/services/supabase/client', () => ({
  getSupabase: () => mockClient,
  isSupabaseConfigured: () => mockClient !== null,
}));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/reminders/notifications', () => ({ cancelReminder: jest.fn(async () => undefined) }));
jest.mock('expo-file-system', () => ({
  Paths: { document: {} },
  Directory: jest.fn(() => ({ exists: false, delete: jest.fn() })),
}));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = jest.requireActual('react-native');
  return {
    isAvailableAsync: jest.fn(async () => false),
    signInAsync: jest.fn(),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
    AppleAuthenticationButton: Pressable,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockClient = { auth: mockAuth, functions: { invoke: mockInvoke } };
  resetSessionStoreForTests();
});

describe('SignInView', () => {
  test('explains when accounts are not available in this build', async () => {
    await render(<SignInView isConfigured={false} onSignedIn={jest.fn()} />);
    expect(screen.getByText(NOT_CONFIGURED_MESSAGE)).toBeTruthy();
  });

  test('sends a code, then verifies it and reports success', async () => {
    const onSignedIn = jest.fn();
    await render(<SignInView isConfigured onSignedIn={onSignedIn} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'Grace@Example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a sign-in code' }));

    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'grace@example.com', options: { shouldCreateUser: true } });
    expect(await screen.findByText(/We sent a sign-in code to grace@example.com/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Sign-in code'), '12 34 56');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify and sign in' }));

    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ email: 'grace@example.com', token: '123456', type: 'email' });
    expect(onSignedIn).toHaveBeenCalled();
  });

  test('shows validation errors without calling the server', async () => {
    await render(<SignInView isConfigured onSignedIn={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a sign-in code' }));

    expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });
});

describe('AccountView', () => {
  const db = createTestDb();

  test('signed out: explains accounts are optional and offers sign in', async () => {
    const onSignIn = jest.fn();
    await render(<AccountView db={db} isConfigured onSignIn={onSignIn} />);
    await act(async () => undefined);

    expect(screen.getByText(/works fully without an account/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in or create an account' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  test('not configured: shows a graceful message instead of sign in', async () => {
    mockClient = null;
    resetSessionStoreForTests();
    await render(<AccountView db={db} isConfigured={false} onSignIn={jest.fn()} />);

    expect(screen.getByText(NOT_CONFIGURED_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in or create an account' })).toBeNull();
  });

  test('signed in: shows the email and deletes the account after two confirmations', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const keepLocalData = jest.fn();
    useSessionStore.setState({ session: { user: { id: 'u1', email: 'grace@example.com' } } as never, isLoading: false });
    await render(<AccountView db={db} isConfigured onSignIn={jest.fn()} deleteOptions={{ keepLocalData }} />);
    await act(async () => undefined);

    expect(screen.getByText('grace@example.com')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    expect(screen.getByText(/Deleting your account permanently removes/)).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Also erase data on this device' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(alertSpy).toHaveBeenCalledWith('Delete your account?', expect.any(String), expect.any(Array));
    expect(mockInvoke).not.toHaveBeenCalled();

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'Delete account')?.onPress?.());

    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { method: 'POST', body: {} });
    expect(keepLocalData).toHaveBeenCalledWith(db);
    expect(await screen.findByText(/Your account has been deleted/)).toBeTruthy();
    alertSpy.mockRestore();
  });

  test('signed in: cancelling the review keeps the account', async () => {
    useSessionStore.setState({ session: { user: { id: 'u1', email: 'a@b.co' } } as never, isLoading: false });
    await render(<AccountView db={db} isConfigured onSignIn={jest.fn()} />);
    await act(async () => undefined);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep my account' }));

    expect(screen.getByRole('button', { name: 'Delete account…' })).toBeTruthy();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('signed in: sign out calls Supabase', async () => {
    useSessionStore.setState({ session: { user: { id: 'u1', email: 'a@b.co' } } as never, isLoading: false });
    await render(<AccountView db={db} isConfigured onSignIn={jest.fn()} />);
    await act(async () => undefined);

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
