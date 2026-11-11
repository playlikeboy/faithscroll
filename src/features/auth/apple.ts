/**
 * Native Sign in with Apple (iOS) → Supabase `signInWithIdToken`.
 * Apple receives the SHA-256 of a random nonce; Supabase receives the raw nonce and checks that
 * the id token's nonce claim is its hash, which prevents token replay.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { getSupabase } from '@/services/supabase/client';

import { CANCELLED, errorContext, failure, friendlyAuthMessage, NOT_CONFIGURED_MESSAGE, SUCCESS, type AuthOutcome } from './errors';

const NONCE_BYTES = 32;

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Random nonce (hex) and its SHA-256 hex digest. */
export async function createNoncePair(): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(Crypto.getRandomBytes(NONCE_BYTES));
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

function isCancellation(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED';
}

export function formatAppleName(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  if (!fullName) return null;
  const name = [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join(' ');
  return name.length > 0 ? name : null;
}

export async function signInWithApple(): Promise<AuthOutcome> {
  const supabase = getSupabase();
  if (!supabase) return failure(NOT_CONFIGURED_MESSAGE);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  let rawNonce: string;
  try {
    const nonce = await createNoncePair();
    rawNonce = nonce.raw;
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: nonce.hashed,
    });
  } catch (error) {
    if (isCancellation(error)) return CANCELLED;
    logger.error('Apple sign-in failed', error, errorContext(error));
    return failure("Sign in with Apple didn't complete. Please try again.");
  }

  if (!credential.identityToken) {
    logger.error('Apple sign-in returned no identity token');
    return failure("Sign in with Apple didn't complete. Please try again.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) {
    logger.error('Supabase rejected the Apple identity token', error, errorContext(error));
    return failure(friendlyAuthMessage(error));
  }

  // Apple shares the name only on the very first authorisation; keep it for the profile.
  const fullName = formatAppleName(credential.fullName);
  if (fullName) {
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        given_name: credential.fullName?.givenName ?? null,
        family_name: credential.fullName?.familyName ?? null,
      },
    });
    if (updateError) logger.warn('Could not save the Apple account name', errorContext(updateError));
  }
  return SUCCESS;
}
