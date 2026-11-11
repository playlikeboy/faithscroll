import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync, type PermissionResponse } from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { logger } from '@/lib/logger';

/** `blocked` = denied and the system will not ask again (only Settings can change it). */
export type MicPermissionState = 'checking' | 'undetermined' | 'granted' | 'denied' | 'blocked';

export function toMicPermissionState(response: Pick<PermissionResponse, 'granted' | 'status' | 'canAskAgain'>): MicPermissionState {
  if (response.granted) return 'granted';
  if (response.status === 'undetermined') return 'undetermined';
  return response.canAskAgain ? 'denied' : 'blocked';
}

/**
 * Microphone permission for the recording screen. Checking never prompts; the system prompt appears
 * only when `request` is called (after the consent explanation, never during onboarding).
 */
export function useMicrophonePermission(): {
  state: MicPermissionState;
  request: () => Promise<boolean>;
  openSettings: () => void;
} {
  const [state, setState] = useState<MicPermissionState>('checking');

  useEffect(() => {
    let mounted = true;
    const check = () => {
      getRecordingPermissionsAsync()
        .then((response) => {
          if (mounted) setState(toMicPermissionState(response));
        })
        .catch((error: unknown) => {
          logger.error('Could not read microphone permission', error);
          if (mounted) setState('undetermined');
        });
    };
    check();
    // Re-check when the user comes back from Settings.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const request = useCallback(async () => {
    try {
      const next = toMicPermissionState(await requestRecordingPermissionsAsync());
      setState(next);
      return next === 'granted';
    } catch (error) {
      logger.error('Microphone permission request failed', error);
      setState('denied');
      return false;
    }
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch((error: unknown) => logger.error('Could not open Settings', error));
  }, []);

  return { state, request, openSettings };
}
