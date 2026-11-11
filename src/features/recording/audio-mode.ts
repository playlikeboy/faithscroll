import { setAudioModeAsync } from 'expo-audio';

import { hasActiveRecording } from './active-recordings';

/**
 * Audio session for recording a sermon: microphone allowed, keeps recording while the phone is
 * locked or the app is in the background, plays in silent mode and pauses other audio.
 */
export function enableRecordingAudioMode(): Promise<void> {
  return setAudioModeAsync({
    allowsRecording: true,
    allowsBackgroundRecording: true,
    shouldPlayInBackground: true,
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    shouldRouteThroughEarpiece: false,
  });
}

/**
 * Audio session for listening back. Skipped while a recording is running, because turning
 * `allowsRecording` off stops active recorders on iOS.
 */
export async function enablePlaybackAudioMode(): Promise<void> {
  if (hasActiveRecording()) return;
  await setAudioModeAsync({
    allowsRecording: false,
    allowsBackgroundRecording: false,
    shouldPlayInBackground: true,
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    shouldRouteThroughEarpiece: false,
  });
}
