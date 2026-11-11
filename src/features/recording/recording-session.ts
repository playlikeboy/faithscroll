/**
 * Recording session controller — the crash-safe recording state machine, independent of React and
 * expo-audio (both are injected) so it can be unit-tested.
 *
 * Crash safety: an m4a file is only playable once the recorder is stopped cleanly (the index box is
 * written last). So the session records in *parts*:
 * - every `checkpointIntervalMs` the current part is stopped and a new one started immediately;
 * - Pause stops (finalises) the part; Resume starts a new one;
 * - a system interruption (call, Siri) finalises the part and waits for the user to resume.
 * At most the part being written is ever at risk. Each part is a `sermon_recordings` row created
 * *before* its file, so crash recovery can find it.
 */
import type { AppDatabase } from '@/db/types';
import { createRecordingPart, deleteRecording, playableDurationMs, updateRecording } from '@/features/sermons/recordings-repository';
import { logger } from '@/lib/logger';
import type { AnalyticsEvent } from '@/services/monitoring/analytics';

import { markRecordingActive, markRecordingInactive } from './active-recordings';

export type SessionPhase = 'idle' | 'starting' | 'recording' | 'paused' | 'interrupted' | 'saved' | 'error';
export type InterruptionKind = 'system' | 'unexpected';

export interface RecorderStatusSnapshot {
  isRecording: boolean;
  /** Duration of the current part (excludes paused time). */
  durationMillis: number;
  metering?: number;
  url: string | null;
}

export interface RecorderPort {
  /** Prepare a new file named after the part id. */
  prepare: (partId: string) => Promise<void>;
  record: () => void;
  stop: () => Promise<void>;
  getStatus: () => RecorderStatusSnapshot;
}

export interface PartFileInfo {
  sizeBytes: number | null;
  /** null when not inspected (a clean stop is trusted). */
  playable: boolean | null;
  durationMs: number | null;
}

export interface RecordingFilesPort {
  fileNameFor: (partId: string) => string;
  /** Move the finished file into the recordings folder; inspect it when the stop was not clean. */
  finalize: (partId: string, recorderUrl: string | null, options: { inspect: boolean }) => Promise<PartFileInfo>;
}

export interface RecorderEvent {
  isFinished: boolean;
  hasError: boolean;
  url: string | null;
  mediaServicesDidReset?: boolean;
}

export interface RecordingSessionDeps {
  db: AppDatabase;
  recorder: RecorderPort;
  files: RecordingFilesPort;
  newId: () => string;
  nowIso: () => string;
  /** Whether a checkpoint (stop + immediate restart) may run now (Android: only in the foreground). */
  canCheckpoint: () => boolean;
  track: (event: AnalyticsEvent) => void;
  checkpointIntervalMs: number;
  /** Consecutive ticks with the recorder not recording before treating it as an interruption. Default 2. */
  interruptionTicks?: number;
}

export interface SessionSnapshot {
  phase: SessionPhase;
  /** Position on the sermon timeline (audio recorded before this session + this session). */
  elapsedMs: number;
  metering: number | null;
  currentPartId: string | null;
  /** Parts finalised in this session, in order. */
  savedPartIds: readonly string[];
  interruption: InterruptionKind | null;
  errorMessage: string | null;
}

export interface BookmarkPosition {
  recordingId: string;
  /** Position inside the part. */
  positionMs: number;
  /** Position on the sermon timeline. */
  elapsedMs: number;
}

const START_FAILED = "We couldn't start the microphone. Make sure no other app is using it, then try again.";
const RESTART_FAILED = 'Recording stopped, but everything up to now is saved. Tap Resume to keep recording.';

export class RecordingSession {
  private snapshot: SessionSnapshot;
  private readonly listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private pendingOps = 0;
  private readonly priorMs: number;
  private closedMs = 0;
  private current: string | null = null;
  private lastPart: { id: string; durationMs: number } | null = null;
  private idleTicks = 0;
  private hasStarted = false;

  constructor(
    private readonly sermonId: string,
    private readonly deps: RecordingSessionDeps,
  ) {
    this.priorMs = playableDurationMs(deps.db, sermonId);
    this.snapshot = {
      phase: 'idle',
      elapsedMs: this.priorMs,
      metering: null,
      currentPartId: null,
      savedPartIds: [],
      interruption: null,
      errorMessage: null,
    };
  }

  getSnapshot = (): SessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Resolves when every queued operation has finished. */
  whenIdle(): Promise<void> {
    return this.queue.then(() => undefined);
  }

  start(): Promise<boolean> {
    return this.enqueue(async () => {
      if (this.snapshot.phase !== 'idle' && this.snapshot.phase !== 'error') return false;
      this.update({ phase: 'starting', errorMessage: null });
      const started = await this.beginPart();
      if (started && !this.hasStarted) {
        this.hasStarted = true;
        this.deps.track({ name: 'recording_started' });
      }
      return started;
    });
  }

  pause(): Promise<void> {
    return this.enqueue(async () => {
      if (this.snapshot.phase !== 'recording') return;
      await this.closeCurrent(false);
      this.update({ phase: 'paused', currentPartId: null, metering: null });
    });
  }

  resume(): Promise<boolean> {
    return this.enqueue(async () => {
      if (this.snapshot.phase !== 'paused' && this.snapshot.phase !== 'interrupted') return false;
      this.update({ phase: 'starting', interruption: null, errorMessage: null });
      return this.beginPart();
    });
  }

  /** Stop & save. Returns the amount of audio recorded in this session. */
  stop(): Promise<{ sessionMs: number }> {
    return this.enqueue(async () => {
      const { phase } = this.snapshot;
      if (phase === 'recording') await this.closeCurrent(false);
      if (phase !== 'saved' && phase !== 'idle') {
        this.update({ phase: 'saved', currentPartId: null, metering: null });
        if (this.closedMs > 0) this.deps.track({ name: 'recording_saved', durationSec: Math.round(this.closedMs / 1000) });
      }
      return { sessionMs: this.closedMs };
    });
  }

  /** Poll the recorder (call every ~250 ms while mounted): elapsed time, level, interruptions, checkpoints. */
  tick(): void {
    if (this.busy || this.snapshot.phase !== 'recording' || !this.current) return;
    const status = this.safeStatus();
    if (!status) return;
    if (!status.isRecording) {
      this.idleTicks += 1;
      if (this.idleTicks >= (this.deps.interruptionTicks ?? 2)) void this.interrupt('system');
      return;
    }
    this.idleTicks = 0;
    this.update({ elapsedMs: this.priorMs + this.closedMs + status.durationMillis, metering: status.metering ?? null });
    if (status.durationMillis >= this.deps.checkpointIntervalMs && this.deps.canCheckpoint()) void this.checkpoint();
  }

  /** Native recorder status events: an unexpected finish/error of the current part is an interruption. */
  handleRecorderEvent(event: RecorderEvent): void {
    if (this.busy || !this.current || this.snapshot.phase !== 'recording') return;
    if (!event.isFinished && !event.hasError && !event.mediaServicesDidReset) return;
    if (event.url && !event.url.includes(this.current)) return; // late event from an earlier part
    void this.interrupt('unexpected');
  }

  /** Current position on the sermon timeline, for `[mm:ss]` note timestamps. */
  currentPositionMs(): number {
    if (this.snapshot.phase === 'recording' && this.current && !this.busy) {
      const status = this.safeStatus();
      if (status) return this.priorMs + this.closedMs + status.durationMillis;
    }
    return this.snapshot.elapsedMs;
  }

  /** Where a bookmark tapped now belongs: the live part, or the end of the last saved part. */
  captureBookmark(): BookmarkPosition | null {
    if (this.snapshot.phase === 'recording' && this.current && !this.busy) {
      const status = this.safeStatus();
      const positionMs = status?.durationMillis ?? this.snapshot.elapsedMs - this.priorMs - this.closedMs;
      return { recordingId: this.current, positionMs, elapsedMs: this.priorMs + this.closedMs + positionMs };
    }
    if (this.lastPart) {
      return { recordingId: this.lastPart.id, positionMs: this.lastPart.durationMs, elapsedMs: this.priorMs + this.closedMs };
    }
    return null;
  }

  /** Finalise anything still recording (screen unmounting). */
  dispose(): Promise<void> {
    return this.stop().then(() => undefined);
  }

  // ---------------------------------------------------------------------------

  private checkpoint(): Promise<void> {
    return this.enqueue(async () => {
      if (this.snapshot.phase !== 'recording' || !this.current) return;
      const finished = await this.stopRecorder();
      const restarted = await this.beginPart(); // restart first: keep the gap minimal
      await this.finalizePart(finished);
      if (!restarted) this.update({ phase: 'interrupted', interruption: 'unexpected', errorMessage: RESTART_FAILED });
    });
  }

  private interrupt(kind: InterruptionKind): Promise<void> {
    return this.enqueue(async () => {
      if (this.snapshot.phase !== 'recording' || !this.current) return;
      await this.closeCurrent(kind === 'unexpected');
      this.update({ phase: 'interrupted', interruption: kind, currentPartId: null, metering: null });
      this.deps.track({ name: 'recording_interrupted' });
    });
  }

  private async beginPart(): Promise<boolean> {
    const id = this.deps.newId();
    try {
      createRecordingPart(this.deps.db, {
        sermonId: this.sermonId,
        id,
        localFileName: this.deps.files.fileNameFor(id),
        startedAt: this.deps.nowIso(),
      });
    } catch (error) {
      logger.error('Could not create recording part', error);
      this.fail(START_FAILED);
      return false;
    }
    markRecordingActive(id);
    try {
      await this.deps.recorder.prepare(id);
      this.deps.recorder.record();
    } catch (error) {
      logger.error('Recorder failed to start', error);
      markRecordingInactive(id);
      this.discardPart(id);
      this.fail(this.lastPart ? RESTART_FAILED : START_FAILED);
      return false;
    }
    this.current = id;
    this.idleTicks = 0;
    this.update({ phase: 'recording', currentPartId: id, interruption: null, errorMessage: null });
    return true;
  }

  private async stopRecorder(): Promise<{ id: string; durationMs: number; url: string | null; stopFailed: boolean }> {
    const id = this.current as string;
    const status = this.safeStatus();
    let stopFailed = false;
    try {
      await this.deps.recorder.stop();
    } catch (error) {
      stopFailed = true;
      logger.error('Recorder failed to stop cleanly', error);
    }
    this.current = null;
    return { id, durationMs: status?.durationMillis ?? 0, url: status?.url ?? null, stopFailed };
  }

  private async closeCurrent(forceInspect: boolean): Promise<void> {
    if (!this.current) return;
    const finished = await this.stopRecorder();
    await this.finalizePart({ ...finished, stopFailed: finished.stopFailed || forceInspect });
  }

  private async finalizePart(part: { id: string; durationMs: number; url: string | null; stopFailed: boolean }): Promise<void> {
    let info: PartFileInfo = { sizeBytes: null, playable: null, durationMs: null };
    try {
      info = await this.deps.files.finalize(part.id, part.url, { inspect: part.stopFailed });
    } catch (error) {
      logger.error('Could not finalise recording file', error);
    }
    const playable = info.playable ?? true;
    const durationMs = info.durationMs ?? part.durationMs;
    try {
      updateRecording(this.deps.db, part.id, {
        status: playable ? 'saved' : 'failed',
        durationMs,
        sizeBytes: info.sizeBytes,
        endedAt: this.deps.nowIso(),
      });
    } catch (error) {
      logger.error('Could not save recording part', error);
    }
    markRecordingInactive(part.id);
    if (!playable) return;
    this.closedMs += durationMs;
    this.lastPart = { id: part.id, durationMs };
    this.update({ elapsedMs: this.priorMs + this.closedMs, savedPartIds: [...this.snapshot.savedPartIds, part.id] });
  }

  private discardPart(id: string): void {
    try {
      deleteRecording(this.deps.db, id);
    } catch (error) {
      logger.error('Could not discard empty recording part', error);
    }
  }

  private fail(message: string): void {
    const phase: SessionPhase = this.lastPart ? 'interrupted' : 'error';
    this.update({ phase, errorMessage: message, currentPartId: null, metering: null, interruption: this.lastPart ? 'unexpected' : null });
  }

  private safeStatus(): RecorderStatusSnapshot | null {
    try {
      return this.deps.recorder.getStatus();
    } catch (error) {
      logger.warn('Recorder status unavailable', { message: error instanceof Error ? error.message : 'unknown' });
      return null;
    }
  }

  /** True while any operation is queued or running (ticks and native events then stand back). */
  private get busy(): boolean {
    return this.pendingOps > 0;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    this.pendingOps += 1;
    const run = this.queue.then(operation).finally(() => {
      this.pendingOps -= 1;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private update(patch: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
