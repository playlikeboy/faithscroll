import { AppState, type NativeEventSubscription } from 'react-native';

import { newId } from '@/lib/ids';
import { logger } from '@/lib/logger';

import { isAnalyticsConsentHydrated, useAnalyticsConsent } from './analytics-consent';
import { getAnalyticsUrl, getAppInfo } from './config';

export interface QueuedEvent {
  name: string;
  props: Record<string, string | number | boolean | null>;
  at: string;
  /** True once a failed upload has been re-queued (events are dropped after a second failure). */
  retried?: boolean;
}

export const MAX_BATCH_SIZE = 20;
export const MAX_QUEUE_SIZE = 100;
export const FLUSH_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Random per-launch id so events can be grouped into sessions without identifying anyone. */
const sessionId = newId();

let queue: readonly QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
let inFlight: Promise<void> | null = null;

function clearTimer(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
}

function ensureLifecycle(): void {
  if (appStateSubscription) return;
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'background' || state === 'inactive') void flushAnalytics();
  });
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalytics();
  }, FLUSH_INTERVAL_MS);
}

export function enqueueEvent(event: QueuedEvent): void {
  queue = [...queue, event].slice(-MAX_QUEUE_SIZE);
  ensureLifecycle();
  if (queue.length >= MAX_BATCH_SIZE) void flushAnalytics();
  else scheduleFlush();
}

async function post(url: string, body: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function sendBatch(url: string, batch: readonly QueuedEvent[]): Promise<void> {
  const { version, platform } = getAppInfo();
  const body = JSON.stringify({
    schemaVersion: 1,
    installId: useAnalyticsConsent.getState().ensureInstallId(),
    sessionId,
    app: { version, platform },
    events: batch.map(({ name, props, at }) => ({ name, props, at })),
  });
  try {
    await post(url, body);
  } catch (error) {
    const retry = batch.filter((event) => !event.retried).map((event) => ({ ...event, retried: true }));
    queue = [...retry, ...queue].slice(-MAX_QUEUE_SIZE);
    logger.warn('Analytics upload failed; will retry later', {
      count: batch.length,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/** Upload queued events now. Drops them if the user opted out. Never throws. */
export async function flushAnalytics(): Promise<void> {
  if (inFlight) return inFlight;
  clearTimer();
  const url = getAnalyticsUrl();
  if (!url || queue.length === 0) return;
  if (!isAnalyticsConsentHydrated()) {
    scheduleFlush();
    return;
  }
  if (!useAnalyticsConsent.getState().enabled) {
    queue = [];
    return;
  }
  const batch = queue.slice(0, MAX_BATCH_SIZE);
  queue = queue.slice(batch.length);
  inFlight = sendBatch(url, batch).finally(() => {
    inFlight = null;
    if (queue.length > 0) scheduleFlush();
  });
  return inFlight;
}

export function clearAnalyticsQueue(): void {
  queue = [];
  clearTimer();
}

export function getQueuedEventCount(): number {
  return queue.length;
}

/** Test helper. */
export function resetAnalyticsTransportForTests(): void {
  clearAnalyticsQueue();
  appStateSubscription?.remove();
  appStateSubscription = null;
  inFlight = null;
}
