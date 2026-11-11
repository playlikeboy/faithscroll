import { useCallback } from 'react';

import { usePassagePicker } from '@/features/bible/use-passage-picker';
import { logger } from '@/lib/logger';

import { passageFromRange, rangeFromPassage } from './passage';
import type { PassageValue } from './types';

/** Opens the shared passage picker and returns the stored passage shape (or null when cancelled/failed). */
export function usePickPassage(title: string): (current: PassageValue | null) => Promise<PassageValue | null> {
  const pickPassage = usePassagePicker();
  return useCallback(
    async (current: PassageValue | null) => {
      try {
        const range = await pickPassage({ title, initial: current ? rangeFromPassage(current) : null });
        return range ? passageFromRange(range) : null;
      } catch (error) {
        logger.error('Passage picker failed', error);
        return null;
      }
    },
    [pickPassage, title],
  );
}
