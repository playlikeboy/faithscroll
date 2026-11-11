/**
 * CONTRACT STUB — owned by the monetization agent (implemented).
 * Initialise crash reporting (Sentry) once at startup. A no-op when no DSN is configured.
 * Privacy: no default PII, no screenshots/view hierarchy/replays, low trace sampling, and every
 * event/breadcrumb/transaction is scrubbed (see ./scrub.ts). `logger.error` is forwarded here.
 */
import * as Sentry from '@sentry/react-native';

import { logger, setErrorReporter } from '@/lib/logger';

import { getSentryDsn } from './config';
import { safeTags, scrubBreadcrumb, scrubEvent, scrubTransaction } from './scrub';

/** Errors are always sent; only a small share of sessions are traced for performance. */
const PRODUCTION_TRACES_SAMPLE_RATE = 0.05;
const MAX_BREADCRUMBS = 40;

let initialized = false;

export function initMonitoring(): void {
  if (initialized) return;
  const dsn = getSentryDsn();
  if (!dsn) {
    logger.debug('Crash reporting disabled: EXPO_PUBLIC_SENTRY_DSN is not set');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: __DEV__ ? 'development' : 'production',
      sendDefaultPii: false,
      tracesSampleRate: __DEV__ ? 0 : PRODUCTION_TRACES_SAMPLE_RATE,
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      maxBreadcrumbs: MAX_BREADCRUMBS,
      beforeSend: scrubEvent,
      beforeSendTransaction: scrubTransaction,
      beforeBreadcrumb: scrubBreadcrumb,
    });
    setErrorReporter((error, context) => {
      Sentry.captureException(error, { tags: safeTags(context) });
    });
    initialized = true;
  } catch (error) {
    // Crash reporting must never break the app.
    logger.warn('Crash reporting could not start', { reason: error instanceof Error ? error.name : 'unknown' });
  }
}

/** Test helper. */
export function resetMonitoringForTests(): void {
  initialized = false;
  setErrorReporter(null);
}
