/**
 * Runs crash recovery once per app launch (from the sermon list or detail screen, whichever opens
 * first) and exposes a dismissible notice describing what was found.
 */
import { useEffect } from 'react';
import { create } from 'zustand';

import { db } from '@/db/client';
import { logger } from '@/lib/logger';

import { recoverInterruptedRecordings, type RecoveryResult } from './recover-recordings';
import { recoveryNoticeFor, type RecoveryNoticeData } from './recovery-notice';

interface RecoveryState {
  hasRun: boolean;
  result: RecoveryResult | null;
  dismissed: boolean;
}

const useRecoveryStore = create<RecoveryState>(() => ({ hasRun: false, result: null, dismissed: false }));

export function runRecordingRecoveryOnce(): void {
  if (useRecoveryStore.getState().hasRun) return;
  useRecoveryStore.setState({ hasRun: true });
  try {
    useRecoveryStore.setState({ result: recoverInterruptedRecordings(db) });
  } catch (error) {
    logger.error('Recording recovery failed', error);
  }
}

export function useRecordingRecovery(): { notice: RecoveryNoticeData | null; dismiss: () => void } {
  const result = useRecoveryStore((state) => state.result);
  const dismissed = useRecoveryStore((state) => state.dismissed);

  useEffect(() => {
    runRecordingRecoveryOnce();
  }, []);

  return {
    notice: dismissed ? null : recoveryNoticeFor(result),
    dismiss: () => useRecoveryStore.setState({ dismissed: true }),
  };
}
