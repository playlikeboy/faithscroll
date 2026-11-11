/** Binds a crash-safe `RecordingSession` to expo-audio for the recording screen. */
import { useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { db } from '@/db/client';
import { newId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { nowIso } from '@/lib/time';
import { track } from '@/services/monitoring/analytics';

import { enableRecordingAudioMode } from './audio-mode';
import { appendLevel, meteringToLevel } from './level';
import { createRecorderPort } from './recorder-adapter';
import { recordingFilesPort } from './recording-files';
import { CHECKPOINT_INTERVAL_MS, RECORDER_TICK_MS, SPEECH_RECORDING_OPTIONS } from './recording-options';
import { RecordingSession, type BookmarkPosition, type SessionSnapshot } from './recording-session';

export interface SermonRecorder {
  snapshot: SessionSnapshot;
  /** Recent input levels (0…1) for the meter; empty when metering is unavailable. */
  levels: number[];
  start: () => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<boolean>;
  stop: () => Promise<{ sessionMs: number }>;
  captureBookmark: () => BookmarkPosition | null;
  currentPositionMs: () => number;
}

/**
 * Android: restarting the recorder re-starts its foreground service, which Android 12+ forbids from the
 * background — so checkpoints wait until the app is in the foreground. iOS checkpoints at any time.
 */
function canCheckpointNow(): boolean {
  return Platform.OS !== 'android' || AppState.currentState === 'active';
}

async function prepareAudioSession(): Promise<void> {
  try {
    await enableRecordingAudioMode();
  } catch (error) {
    // The session start will fail with a friendly message if recording is really unavailable.
    logger.error('Could not configure the audio session for recording', error);
  }
}

export function useSermonRecorder(sermonId: string): SermonRecorder {
  const sessionRef = useRef<RecordingSession | null>(null);
  const recorder = useAudioRecorder(SPEECH_RECORDING_OPTIONS, (status) => sessionRef.current?.handleRecorderEvent(status));
  const [session] = useState(
    () =>
      new RecordingSession(sermonId, {
        db,
        recorder: createRecorderPort(recorder),
        files: recordingFilesPort,
        newId,
        nowIso,
        canCheckpoint: canCheckpointNow,
        track,
        checkpointIntervalMs: CHECKPOINT_INTERVAL_MS,
      }),
  );
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [levels, setLevels] = useState<number[]>([]);

  useEffect(() => {
    sessionRef.current = session;
    return () => {
      sessionRef.current = null;
    };
  }, [session]);

  useEffect(() => {
    const timer = setInterval(() => {
      session.tick();
      const { phase, metering } = session.getSnapshot();
      const level = phase === 'recording' ? meteringToLevel(metering) : null;
      if (level !== null) setLevels((previous) => appendLevel(previous, level));
    }, RECORDER_TICK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') session.tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [session]);

  // Never leave a part open if the screen goes away.
  useEffect(() => () => void session.dispose(), [session]);

  const start = useCallback(async () => {
    await prepareAudioSession();
    return session.start();
  }, [session]);

  const resume = useCallback(async () => {
    await prepareAudioSession();
    return session.resume();
  }, [session]);

  const pause = useCallback(() => session.pause(), [session]);
  const stop = useCallback(() => session.stop(), [session]);
  const captureBookmark = useCallback(() => session.captureBookmark(), [session]);
  const currentPositionMs = useCallback(() => session.currentPositionMs(), [session]);

  return { snapshot, levels, start, pause, resume, stop, captureBookmark, currentPositionMs };
}
