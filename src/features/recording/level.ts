/** Input level helpers for the recording meter. */

export const WAVEFORM_BARS = 36;
const FLOOR_DB = -60;

/** Recorder metering (dBFS, about -160…0) to a 0…1 level; null when metering is unavailable. */
export function meteringToLevel(metering: number | undefined | null): number | null {
  if (metering === undefined || metering === null || Number.isNaN(metering)) return null;
  const level = (metering - FLOOR_DB) / -FLOOR_DB;
  return Math.min(1, Math.max(0, level));
}

/** New history with `level` appended, keeping the last `WAVEFORM_BARS` values. */
export function appendLevel(history: readonly number[], level: number): number[] {
  const next = [...history, level];
  return next.length > WAVEFORM_BARS ? next.slice(next.length - WAVEFORM_BARS) : next;
}
