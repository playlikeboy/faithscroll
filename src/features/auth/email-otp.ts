/**
 * Email one-time code sign-in (no deep links): request a code, then verify it in-app.
 * The hosted project's "Magic Link" email template must include `{{ .Token }}` (docs/BACKEND.md).
 */
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { getSupabase } from '@/services/supabase/client';

import { errorContext, failure, friendlyAuthMessage, NOT_CONFIGURED_MESSAGE, SUCCESS, type AuthOutcome } from './errors';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Please enter a valid email address.' }).max(254, 'That email address is too long.'));

export const otpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6,10}$/, 'Enter the code from the email (digits only).'));

export type FieldCheck = { ok: true; value: string } | { ok: false; message: string };

function check(schema: z.ZodType<string, string>, input: string): FieldCheck {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, message: result.error.issues[0]?.message ?? 'Please check this field.' };
}

export function validateEmail(input: string): FieldCheck {
  return check(emailSchema, input);
}

export function validateOtpCode(input: string): FieldCheck {
  return check(otpCodeSchema, input);
}

export async function requestEmailCode(emailInput: string): Promise<AuthOutcome> {
  const email = validateEmail(emailInput);
  if (!email.ok) return failure(email.message);
  const supabase = getSupabase();
  if (!supabase) return failure(NOT_CONFIGURED_MESSAGE);

  const { error } = await supabase.auth.signInWithOtp({ email: email.value, options: { shouldCreateUser: true } });
  if (error) {
    logger.warn('Email code request failed', errorContext(error));
    return failure(friendlyAuthMessage(error, "We couldn't send a code right now. Please try again."));
  }
  return SUCCESS;
}

export async function verifyEmailCode(emailInput: string, codeInput: string): Promise<AuthOutcome> {
  const email = validateEmail(emailInput);
  if (!email.ok) return failure(email.message);
  const code = validateOtpCode(codeInput);
  if (!code.ok) return failure(code.message);
  const supabase = getSupabase();
  if (!supabase) return failure(NOT_CONFIGURED_MESSAGE);

  const { error } = await supabase.auth.verifyOtp({ email: email.value, token: code.value, type: 'email' });
  if (error) {
    logger.warn('Email code verification failed', errorContext(error));
    return failure(
      friendlyAuthMessage(error, 'That code is incorrect or has expired. Check the latest email or request a new code.'),
    );
  }
  return SUCCESS;
}
