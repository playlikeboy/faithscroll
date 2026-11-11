/**
 * Debounced autosave for editors (sermon notes, journal entries, prayers).
 *
 * - Saves the *latest* value `delayMs` after the last change.
 * - Never saves a value equal to the last saved one (the value at mount — or when
 *   `enabled` turns on — is the baseline and is not written back).
 * - Flushes pending changes on unmount and when the app leaves the foreground.
 * - Saves run one at a time, in order; a failure sets `status: 'error'` + `error`
 *   and the next change or `flush()` retries.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getErrorMessage, logger } from '@/lib/logger';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseAutosaveOptions<T> {
  /** Debounce delay after the last change. Default 800 ms. */
  delayMs?: number;
  /**
   * When false nothing is scheduled (e.g. while the entry is still loading).
   * When it turns true, the current value becomes the saved baseline.
   */
  enabled?: boolean;
  /** Equality used to skip unchanged values. Default: `Object.is`, then JSON comparison for objects. */
  isEqual?: (a: T, b: T) => boolean;
}

export interface AutosaveResult {
  status: AutosaveStatus;
  /** The last save error (cleared by the next successful save). */
  error: Error | null;
  /**
   * Save pending changes now (e.g. before navigating away). Resolves `true` when everything is
   * saved (or nothing needed saving) and `false` when the save failed — the failure is also
   * reported through `status`/`error`.
   */
  flush: () => Promise<boolean>;
}

export const DEFAULT_AUTOSAVE_DELAY_MS = 800;

export function defaultIsEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(getErrorMessage(error));
}

interface AutosaveState {
  status: AutosaveStatus;
  error: Error | null;
}

const INITIAL_STATE: AutosaveState = { status: 'idle', error: null };

export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void> | void,
  options: UseAutosaveOptions<T> = {},
): AutosaveResult {
  const { delayMs = DEFAULT_AUTOSAVE_DELAY_MS, enabled = true, isEqual = defaultIsEqual } = options;
  const [state, setState] = useState<AutosaveState>(INITIAL_STATE);

  const latestRef = useRef(value);
  const savedRef = useRef(value);
  const saveRef = useRef(save);
  const isEqualRef = useRef(isEqual);
  const enabledRef = useRef(enabled);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const mountedRef = useRef(true);

  // Keep the latest inputs visible to timers and flushes (runs before the effects below).
  useEffect(() => {
    latestRef.current = value;
    saveRef.current = save;
    isEqualRef.current = isEqual;
  });

  const update = useCallback((next: AutosaveState) => {
    if (mountedRef.current) setState(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSave = useCallback(async (): Promise<boolean> => {
    const next = latestRef.current;
    if (!enabledRef.current || isEqualRef.current(next, savedRef.current)) return true;
    update({ status: 'saving', error: null });
    try {
      await saveRef.current(next);
      savedRef.current = next;
      update({ status: 'saved', error: null });
      return true;
    } catch (caught) {
      const error = toError(caught);
      logger.error('Autosave failed', error);
      update({ status: 'error', error });
      return false;
    }
  }, [update]);

  const flush = useCallback((): Promise<boolean> => {
    clearTimer();
    const queued = queueRef.current.then(runSave);
    queueRef.current = queued;
    return queued;
  }, [clearTimer, runSave]);

  // When enabled turns on, the current value is the baseline (e.g. freshly loaded entry).
  useEffect(() => {
    if (enabled && !enabledRef.current) savedRef.current = latestRef.current;
    enabledRef.current = enabled;
    if (!enabled) clearTimer();
  }, [enabled, clearTimer]);

  // Debounce: (re)schedule a save whenever the value changes.
  useEffect(() => {
    if (!enabled) return;
    clearTimer();
    if (isEqualRef.current(value, savedRef.current)) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, delayMs);
  }, [value, enabled, delayMs, clearTimer, flush]);

  // Flush when the app goes to the background / becomes inactive.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') void flush();
    });
    return () => subscription?.remove();
  }, [flush]);

  // Flush on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void flush();
    };
  }, [flush]);

  return { status: state.status, error: state.error, flush };
}
