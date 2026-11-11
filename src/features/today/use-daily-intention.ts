import { toLocalDateString } from '@/lib/time';
import { usePreferences } from '@/stores/preferences';

export const MAX_INTENTION_LENGTH = 140;

export interface DailyIntention {
  /** Today's intention, or null (yesterday's intention quietly expires). */
  intention: string | null;
  save: (text: string) => void;
  clear: () => void;
}

export function intentionForDate(
  stored: { date: string; text: string } | null,
  localDate: string,
): string | null {
  return stored && stored.date === localDate && stored.text.trim() ? stored.text : null;
}

export function useDailyIntention(now: Date): DailyIntention {
  const stored = usePreferences((s) => s.dailyIntention);
  const setDailyIntention = usePreferences((s) => s.setDailyIntention);
  const localDate = toLocalDateString(now);

  return {
    intention: intentionForDate(stored, localDate),
    save: (text) => {
      const trimmed = text.trim().slice(0, MAX_INTENTION_LENGTH);
      setDailyIntention(trimmed ? { date: localDate, text: trimmed } : null);
    },
    clear: () => setDailyIntention(null),
  };
}
