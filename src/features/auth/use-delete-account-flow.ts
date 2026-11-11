import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';

import { deleteAccount } from './account-actions';
import { eraseLocalUserData } from './erase-local-data';

export type DeleteStep = 'idle' | 'review' | 'deleting' | 'done';

export interface DeleteAccountFlow {
  step: DeleteStep;
  eraseLocal: boolean;
  error: string | null;
  /** Message shown after a successful deletion. */
  result: string | null;
  setEraseLocal: (value: boolean) => void;
  start: () => void;
  cancel: () => void;
  /** Second confirmation (native alert); deletes on "Delete account". */
  confirm: () => void;
}

export interface DeleteAccountOptions {
  /** Runs after a successful deletion when the user keeps data on this device. */
  keepLocalData?: (db: AppDatabase) => Promise<void> | void;
  /** Runs after every successful deletion (after local cleanup). */
  afterDeletion?: () => void;
}

export function useDeleteAccountFlow(db: AppDatabase, options: DeleteAccountOptions = {}): DeleteAccountFlow {
  const { keepLocalData, afterDeletion } = options;
  const [step, setStep] = useState<DeleteStep>('idle');
  const [eraseLocal, setEraseLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const perform = useCallback(async () => {
    setStep('deleting');
    setError(null);
    const outcome = await deleteAccount();
    if (outcome.status !== 'success') {
      setError(outcome.status === 'error' ? outcome.message : null);
      setStep('review');
      return;
    }
    track({ name: 'account_deleted' });
    try {
      if (eraseLocal) await eraseLocalUserData(db);
      else await keepLocalData?.(db);
      setResult(
        eraseLocal
          ? 'Your account and the data on this device have been deleted.'
          : 'Your account has been deleted. Your notes remain on this device and keep working without an account.',
      );
    } catch (cleanupError) {
      logger.error('Local cleanup after account deletion failed', cleanupError);
      setResult(
        'Your account has been deleted, but some data on this device could not be erased. You can remove it in Settings › Data.',
      );
    }
    afterDeletion?.();
    setStep('done');
  }, [db, eraseLocal, keepLocalData, afterDeletion]);

  const confirm = useCallback(() => {
    const detail = eraseLocal
      ? 'Your account, your cloud data and everything on this device will be permanently deleted. This cannot be undone.'
      : 'Your account and your cloud data will be permanently deleted. This cannot be undone.';
    Alert.alert('Delete your account?', detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => void perform() },
    ]);
  }, [eraseLocal, perform]);

  const start = useCallback(() => {
    setError(null);
    setResult(null);
    setStep('review');
  }, []);

  const cancel = useCallback(() => {
    setError(null);
    setEraseLocal(false);
    setStep('idle');
  }, []);

  return { step, eraseLocal, error, result, setEraseLocal, start, cancel, confirm };
}
