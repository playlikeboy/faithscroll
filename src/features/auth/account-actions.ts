/**
 * Sign out and in-app account deletion (App Store requirement 5.1.1(v)).
 */
import { logger } from '@/lib/logger';
import { getSupabase } from '@/services/supabase/client';

import {
  errorContext,
  failure,
  friendlyAuthMessage,
  isNetworkError,
  NOT_CONFIGURED_MESSAGE,
  OFFLINE_MESSAGE,
  SUCCESS,
  type AuthOutcome,
} from './errors';

export const DELETE_ACCOUNT_FUNCTION = 'delete-account';

/** Signs out on this device only (other devices stay signed in). Local data is kept. */
export async function signOut(): Promise<AuthOutcome> {
  const supabase = getSupabase();
  if (!supabase) return SUCCESS;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    logger.warn('Sign out failed', errorContext(error));
    return failure(isNetworkError(error) ? OFFLINE_MESSAGE : "We couldn't sign you out. Please try again.");
  }
  return SUCCESS;
}

interface FunctionErrorBody {
  error?: { code?: string };
}

async function readFunctionErrorCode(error: unknown): Promise<string | null> {
  const context = typeof error === 'object' && error !== null ? (error as { context?: unknown }).context : undefined;
  if (!context || typeof (context as Response).json !== 'function') return null;
  try {
    const body = (await (context as Response).json()) as FunctionErrorBody;
    return typeof body.error?.code === 'string' ? body.error.code : null;
  } catch {
    return null;
  }
}

/**
 * Permanently deletes the signed-in account on the server (cloud rows, cloud audio, auth user),
 * then clears the local session. The caller decides what happens to data on this device.
 */
export async function deleteAccount(): Promise<AuthOutcome> {
  const supabase = getSupabase();
  if (!supabase) return failure(NOT_CONFIGURED_MESSAGE);

  const { error } = await supabase.functions.invoke(DELETE_ACCOUNT_FUNCTION, { method: 'POST', body: {} });
  if (error) {
    const code = await readFunctionErrorCode(error);
    logger.error('Account deletion failed', error, { ...errorContext(error), ...(code ? { code } : {}) });
    if (isNetworkError(error)) return failure(OFFLINE_MESSAGE);
    if (code === 'unauthorized') return failure('Your session has expired. Please sign in again, then delete your account.');
    return failure(friendlyAuthMessage(error, "We couldn't delete your account right now. Nothing was deleted on this device. Please try again."));
  }

  // The user no longer exists, so the server call may fail; the local session is cleared regardless.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
  if (signOutError) logger.warn('Local sign-out after account deletion reported an error', errorContext(signOutError));
  return SUCCESS;
}
