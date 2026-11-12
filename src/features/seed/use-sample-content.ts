import { useCallback, useState } from 'react';

import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';
import { cancelReminder } from '@/features/reminders/scheduler';

import { hasSampleContent, removeSampleContent } from './remove-sample-content';

export type SampleContentStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

export interface SampleContentState {
  /** True while seeded sample items are still in the library. */
  hasSamples: boolean;
  status: SampleContentStatus;
  removeSamples: () => Promise<void>;
}

function checkSamples(db: AppDatabase): boolean {
  try {
    return hasSampleContent(db);
  } catch (error) {
    logger.error('Checking for sample content failed', error);
    return false;
  }
}

/** Settings → Your data: whether sample content exists, and removing it. */
export function useSampleContent(db: AppDatabase): SampleContentState {
  const [hasSamples, setHasSamples] = useState(() => checkSamples(db));
  const [status, setStatus] = useState<SampleContentStatus>({ kind: 'idle' });

  const removeSamples = useCallback(async () => {
    setStatus({ kind: 'working' });
    try {
      const { notificationIds } = removeSampleContent(db);
      await Promise.all(notificationIds.map((id) => cancelReminder(id)));
      setHasSamples(false);
      setStatus({ kind: 'done', message: 'Sample content removed. Everything you wrote yourself is untouched.' });
    } catch (error) {
      logger.error('Removing sample content failed', error);
      setHasSamples(checkSamples(db));
      setStatus({ kind: 'error', message: 'We couldn’t remove the sample content. Please try again.' });
    }
  }, [db]);

  return { hasSamples, status, removeSamples };
}
