import type { AudioRecorder } from 'expo-audio';

import { logger } from '@/lib/logger';

import { FALLBACK_RECORDING_OPTIONS, optionsForPart, SPEECH_RECORDING_OPTIONS } from './recording-options';
import type { RecorderPort } from './recording-session';

/**
 * Adapts an expo-audio `AudioRecorder` to the session's `RecorderPort`.
 * Every part is prepared with its own file name. If the device rejects the speech preset,
 * the widely supported fallback preset is used from then on.
 */
export function createRecorderPort(recorder: AudioRecorder): RecorderPort {
  let options = SPEECH_RECORDING_OPTIONS;

  return {
    prepare: async (partId) => {
      try {
        await recorder.prepareToRecordAsync(optionsForPart(options, partId));
      } catch (error) {
        if (options === FALLBACK_RECORDING_OPTIONS) throw error;
        logger.warn('Speech recording preset rejected; using fallback preset', {
          message: error instanceof Error ? error.message : 'unknown',
        });
        options = FALLBACK_RECORDING_OPTIONS;
        await recorder.prepareToRecordAsync(optionsForPart(options, partId));
      }
    },
    record: () => recorder.record(),
    stop: () => recorder.stop(),
    getStatus: () => {
      const status = recorder.getStatus();
      return {
        isRecording: status.isRecording,
        durationMillis: status.durationMillis,
        metering: status.metering,
        url: status.url,
      };
    },
  };
}
