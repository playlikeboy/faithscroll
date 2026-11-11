import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';

/** Each part is finalised after this long so a crash can lose at most one part. */
export const CHECKPOINT_INTERVAL_MS = 10 * 60 * 1000;

/** How often the recording screen polls the recorder (elapsed time, level, interruptions). */
export const RECORDER_TICK_MS = 250;

export const RECORDING_EXTENSION = '.m4a';

/**
 * Speech preset: AAC-LC in an .m4a container, mono, 22.05 kHz, 32 kbps (~14 MB per hour, so a
 * 90-minute sermon is ~22 MB in total and each 10-minute part ~2.4 MB — well under the 25 MB upload limit).
 * Metering powers the live level meter.
 */
export const SPEECH_RECORDING_OPTIONS: RecordingOptions = {
  extension: RECORDING_EXTENSION,
  sampleRate: 22_050,
  numberOfChannels: 1,
  bitRate: 32_000,
  isMeteringEnabled: true,
  directory: 'document',
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac', audioSource: 'mic' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.HIGH },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32_000 },
};

/** Used if a device rejects the speech preset: widely supported 44.1 kHz mono at 64 kbps. */
export const FALLBACK_RECORDING_OPTIONS: RecordingOptions = {
  ...SPEECH_RECORDING_OPTIONS,
  sampleRate: 44_100,
  bitRate: 64_000,
  web: { mimeType: 'audio/webm', bitsPerSecond: 64_000 },
};

/** Recorder options for one part: the file is named after the part id. */
export function optionsForPart(base: RecordingOptions, partId: string): RecordingOptions {
  return { ...base, directory: 'document', fileName: partId };
}
