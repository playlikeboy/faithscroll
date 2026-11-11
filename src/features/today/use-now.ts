import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * The current time, refreshed whenever the app returns to the foreground so the greeting,
 * date, prompt and Verse of the Day roll over without a restart. No timers.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => subscription.remove();
  }, []);
  return now;
}
