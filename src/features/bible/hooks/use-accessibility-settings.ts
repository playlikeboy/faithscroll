import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { logger } from '@/lib/logger';

type AccessibilitySetting = 'screenReaderChanged' | 'reduceMotionChanged';

function useAccessibilitySetting(
  event: AccessibilitySetting,
  read: () => Promise<boolean>,
): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let isActive = true;
    read()
      .then((value) => {
        if (isActive) setEnabled(value);
      })
      .catch((error: unknown) => logger.warn('Could not read accessibility setting', { event, error }));
    const subscription = AccessibilityInfo.addEventListener(event, (value: boolean) => setEnabled(value));
    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [event, read]);

  return enabled;
}

const readScreenReader = () => AccessibilityInfo.isScreenReaderEnabled();
const readReduceMotion = () => AccessibilityInfo.isReduceMotionEnabled();

/** True while VoiceOver / TalkBack is running. */
export function useScreenReaderEnabled(): boolean {
  return useAccessibilitySetting('screenReaderChanged', readScreenReader);
}

/** True when the user asked the system to reduce motion. */
export function useReduceMotion(): boolean {
  return useAccessibilitySetting('reduceMotionChanged', readReduceMotion);
}
