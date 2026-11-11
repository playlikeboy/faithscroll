/**
 * CONTRACT STUB — owned by the bible-ui agent.
 * Opens the `bible/passage-picker` modal and resolves with the chosen range
 * (or null if the user cancels). Used by sermons, journal, prayers and the note editor.
 *
 *   const pickPassage = usePassagePicker();
 *   const range = await pickPassage({ title: 'Main passage' });
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { logger } from '@/lib/logger';

import { cancelPassageRequest, createPassageRequest } from './reader/passage-requests';
import { bibleRoutes } from './reader/routes';
import type { VerseRange } from './types';
import { rangeToIds } from './verse-id';

export {
  cancelPassageRequest,
  createPassageRequest,
  hasPendingPassageRequest,
  resolvePassageRequest,
} from './reader/passage-requests';

export interface PassagePickerOptions {
  title?: string;
  initial?: VerseRange | null;
}

export function usePassagePicker(): (options?: PassagePickerOptions) => Promise<VerseRange | null> {
  const openRequests = useRef(new Set<string>());

  // If the calling screen goes away, settle its open requests so nothing waits forever.
  useEffect(() => {
    const requests = openRequests.current;
    return () => {
      for (const id of requests) cancelPassageRequest(id);
      requests.clear();
    };
  }, []);

  return useCallback((options: PassagePickerOptions = {}) => {
    const { id, promise } = createPassageRequest();
    openRequests.current.add(id);
    const initial = options.initial ? rangeToIds(options.initial) : null;
    try {
      router.push(
        bibleRoutes.passagePicker({
          requestId: id,
          title: options.title,
          start: initial?.startVerseId,
          end: initial?.endVerseId,
        }),
      );
    } catch (error) {
      logger.error('Could not open the passage picker', error);
      cancelPassageRequest(id);
    }
    return promise.finally(() => openRequests.current.delete(id));
  }, []);
}
