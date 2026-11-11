/**
 * Ids of recording parts being written right now in this process. Crash recovery must never touch
 * these (their files are still open), so screens can safely call recovery while a recording runs.
 */
const active = new Set<string>();

export function markRecordingActive(id: string): void {
  active.add(id);
}

export function markRecordingInactive(id: string): void {
  active.delete(id);
}

export function isRecordingActive(id: string): boolean {
  return active.has(id);
}

/** True while any part is being recorded (playback must not switch the audio session then). */
export function hasActiveRecording(): boolean {
  return active.size > 0;
}
