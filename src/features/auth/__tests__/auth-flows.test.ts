import * as AppleAuthentication from 'expo-apple-authentication';

import { deleteAccount, signOut } from '../account-actions';
import { createNoncePair, formatAppleName, isAppleSignInAvailable, signInWithApple } from '../apple';
import { requestEmailCode, validateEmail, validateOtpCode, verifyEmailCode } from '../email-otp';
import { friendlyAuthMessage, isNetworkError, NOT_CONFIGURED_MESSAGE, OFFLINE_MESSAGE } from '../errors';

const mockAuth = {
  signInWithIdToken: jest.fn(),
  updateUser: jest.fn(),
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  signOut: jest.fn(),
};
const mockFunctions = { invoke: jest.fn() };
let mockClient: unknown = null;

jest.mock('@/services/supabase/client', () => ({
  getSupabase: () => mockClient,
  isSupabaseConfigured: () => mockClient !== null,
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytes: (count: number) => new Uint8Array(count).fill(171),
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => `sha256:${data}`),
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const signInAsync = AppleAuthentication.signInAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockClient = { auth: mockAuth, functions: mockFunctions };
  mockAuth.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
  mockAuth.updateUser.mockResolvedValue({ data: {}, error: null });
  mockAuth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  mockAuth.verifyOtp.mockResolvedValue({ data: {}, error: null });
  mockAuth.signOut.mockResolvedValue({ error: null });
  mockFunctions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
});

describe('Sign in with Apple', () => {
  test('sends the hashed nonce to Apple and the raw nonce to Supabase', async () => {
    signInAsync.mockResolvedValue({ identityToken: 'apple-id-token', fullName: null });

    const outcome = await signInWithApple();

    expect(outcome).toEqual({ status: 'success' });
    const { raw, hashed } = await createNoncePair();
    expect(signInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: hashed }));
    expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-id-token', nonce: raw });
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  test('saves the name Apple shares on first sign-in', async () => {
    signInAsync.mockResolvedValue({
      identityToken: 'token',
      fullName: { givenName: 'Ruth', middleName: null, familyName: 'Moab', namePrefix: null, nameSuffix: null, nickname: null },
    });

    await signInWithApple();

    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      data: { full_name: 'Ruth Moab', given_name: 'Ruth', family_name: 'Moab' },
    });
  });

  test('reports cancellation without an error message', async () => {
    signInAsync.mockRejectedValue(Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' }));

    await expect(signInWithApple()).resolves.toEqual({ status: 'cancelled' });
    expect(mockAuth.signInWithIdToken).not.toHaveBeenCalled();
  });

  test('fails gracefully when Apple returns no identity token or Supabase rejects it', async () => {
    signInAsync.mockResolvedValue({ identityToken: null, fullName: null });
    await expect(signInWithApple()).resolves.toMatchObject({ status: 'error' });

    signInAsync.mockResolvedValue({ identityToken: 'token', fullName: null });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: {}, error: { name: 'AuthApiError', status: 400, code: 'bad_jwt' } });
    await expect(signInWithApple()).resolves.toEqual({
      status: 'error',
      message: 'Your session has expired. Please sign in again.',
    });
  });

  test('explains when cloud features are not configured', async () => {
    mockClient = null;
    await expect(signInWithApple()).resolves.toEqual({ status: 'error', message: NOT_CONFIGURED_MESSAGE });
  });

  test('is available on iOS when the device supports it', async () => {
    await expect(isAppleSignInAvailable()).resolves.toBe(true);
  });

  test('formats partial names and ignores empty ones', () => {
    expect(formatAppleName(null)).toBeNull();
    expect(
      formatAppleName({ givenName: ' Ana ', middleName: null, familyName: null, namePrefix: null, nameSuffix: null, nickname: null }),
    ).toBe('Ana');
    expect(
      formatAppleName({ givenName: '', middleName: null, familyName: null, namePrefix: null, nameSuffix: null, nickname: null }),
    ).toBeNull();
  });
});

describe('Email one-time code', () => {
  test('validates and normalises email addresses', () => {
    expect(validateEmail('  Grace@Example.COM ')).toEqual({ ok: true, value: 'grace@example.com' });
    expect(validateEmail('not-an-email')).toEqual({ ok: false, message: 'Please enter a valid email address.' });
  });

  test('validates codes, ignoring spaces', () => {
    expect(validateOtpCode('123 456')).toEqual({ ok: true, value: '123456' });
    expect(validateOtpCode('12ab')).toMatchObject({ ok: false });
  });

  test('requests a code that may create the account', async () => {
    await expect(requestEmailCode('grace@example.com')).resolves.toEqual({ status: 'success' });
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'grace@example.com', options: { shouldCreateUser: true } });
  });

  test('does not call Supabase for an invalid email', async () => {
    await expect(requestEmailCode('nope')).resolves.toMatchObject({ status: 'error' });
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });

  test('maps rate limits to a friendly message', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ data: {}, error: { status: 429, code: 'over_email_send_rate_limit' } });
    await expect(requestEmailCode('grace@example.com')).resolves.toEqual({
      status: 'error',
      message: 'Too many codes were requested. Please wait a minute, then try again.',
    });
  });

  test('verifies the code as an email OTP', async () => {
    await expect(verifyEmailCode('grace@example.com', '654321')).resolves.toEqual({ status: 'success' });
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ email: 'grace@example.com', token: '654321', type: 'email' });
  });

  test('explains an expired or wrong code', async () => {
    mockAuth.verifyOtp.mockResolvedValue({ data: {}, error: { status: 403, code: 'otp_expired' } });
    const outcome = await verifyEmailCode('grace@example.com', '000000');
    expect(outcome).toMatchObject({ status: 'error', message: expect.stringContaining('expired') });
  });
});

describe('Sign out and delete account', () => {
  test('signs out on this device only', async () => {
    await expect(signOut()).resolves.toEqual({ status: 'success' });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  test('explains when signing out fails offline', async () => {
    mockAuth.signOut.mockResolvedValue({ error: { name: 'AuthRetryableFetchError', status: 0 } });
    await expect(signOut()).resolves.toEqual({ status: 'error', message: OFFLINE_MESSAGE });
  });

  test('invokes the delete-account function and clears the session', async () => {
    await expect(deleteAccount()).resolves.toEqual({ status: 'success' });
    expect(mockFunctions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST', body: {} });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  test('keeps the session when the server could not delete the account', async () => {
    mockFunctions.invoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', context: { json: async () => ({ error: { code: 'unauthorized' } }) } },
    });

    const outcome = await deleteAccount();

    expect(outcome).toMatchObject({ status: 'error', message: expect.stringContaining('sign in again') });
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  test('reports offline failures', async () => {
    mockFunctions.invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } });
    await expect(deleteAccount()).resolves.toEqual({ status: 'error', message: OFFLINE_MESSAGE });
  });

  test('cannot delete when Supabase is not configured', async () => {
    mockClient = null;
    await expect(deleteAccount()).resolves.toEqual({ status: 'error', message: NOT_CONFIGURED_MESSAGE });
    await expect(signOut()).resolves.toEqual({ status: 'success' });
  });
});

describe('error helpers', () => {
  test('recognises network failures', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError({ status: 400 })).toBe(false);
  });

  test('falls back to the provided message for unknown errors', () => {
    expect(friendlyAuthMessage({ code: 'weird' }, 'Fallback')).toBe('Fallback');
    expect(friendlyAuthMessage({ status: 429 })).toContain('Too many attempts');
  });
});
