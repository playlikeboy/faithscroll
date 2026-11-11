import { useCallback, useState } from 'react';

import { signInWithApple } from './apple';
import { requestEmailCode, validateEmail, validateOtpCode, verifyEmailCode } from './email-otp';
import type { AuthOutcome } from './errors';

export type SignInStep = 'email' | 'code';
export type BusyAction = 'apple' | 'send' | 'verify' | null;

export interface SignInFlow {
  step: SignInStep;
  email: string;
  code: string;
  busy: BusyAction;
  error: string | null;
  notice: string | null;
  setEmail: (value: string) => void;
  setCode: (value: string) => void;
  continueWithApple: () => Promise<void>;
  sendCode: () => Promise<void>;
  verifyCode: () => Promise<void>;
  changeEmail: () => void;
}

/** State machine for the sign-in screen. `onSignedIn` runs once a session exists. */
export function useSignInFlow(onSignedIn: () => void): SignInFlow {
  const [step, setStep] = useState<SignInStep>('email');
  const [email, setEmailValue] = useState('');
  const [code, setCodeValue] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (action: Exclude<BusyAction, null>, task: () => Promise<AuthOutcome>, onSuccess: () => void) => {
      setBusy(action);
      setError(null);
      try {
        const outcome = await task();
        if (outcome.status === 'success') onSuccess();
        else if (outcome.status === 'error') setError(outcome.message);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const setEmail = useCallback((value: string) => {
    setEmailValue(value);
    setError(null);
  }, []);

  const setCode = useCallback((value: string) => {
    setCodeValue(value.replace(/[^\d]/g, ''));
    setError(null);
  }, []);

  const continueWithApple = useCallback(() => run('apple', signInWithApple, onSignedIn), [run, onSignedIn]);

  const sendCode = useCallback(async () => {
    const checked = validateEmail(email);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    await run('send', () => requestEmailCode(checked.value), () => {
      setEmailValue(checked.value);
      setCodeValue('');
      setStep('code');
      setNotice(`We sent a sign-in code to ${checked.value}. It may take a minute to arrive.`);
    });
  }, [email, run]);

  const verifyCode = useCallback(async () => {
    const checked = validateOtpCode(code);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    await run('verify', () => verifyEmailCode(email, checked.value), onSignedIn);
  }, [code, email, run, onSignedIn]);

  const changeEmail = useCallback(() => {
    setStep('email');
    setCodeValue('');
    setError(null);
    setNotice(null);
  }, []);

  return { step, email, code, busy, error, notice, setEmail, setCode, continueWithApple, sendCode, verifyCode, changeEmail };
}
