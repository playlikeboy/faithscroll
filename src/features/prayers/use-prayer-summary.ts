import { db } from '@/db/client';
import { useLiveData } from '@/features/journal/use-live-data';

import { countPrayersByStatus } from './repository';
import type { PrayerStatus } from './types';

const PRAYER_TABLES = ['prayer_entries'] as const;

/** Live count of prayers per status; undefined while loading. */
export function usePrayerSummary(): Record<PrayerStatus, number> | undefined {
  return useLiveData(() => countPrayersByStatus(db), PRAYER_TABLES, 'prayer-summary').data;
}
