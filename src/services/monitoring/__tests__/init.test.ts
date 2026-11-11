import * as Sentry from '@sentry/react-native';

import { logger } from '@/lib/logger';
import { getSentryDsn } from '@/services/monitoring/config';
import { initMonitoring, resetMonitoringForTests } from '@/services/monitoring/init';
import { scrubBreadcrumb, scrubEvent, scrubTransaction } from '@/services/monitoring/scrub';

jest.mock('@sentry/react-native', () => ({ init: jest.fn(), captureException: jest.fn() }));
jest.mock('@/services/monitoring/config', () => ({
  getSentryDsn: jest.fn(),
  getAnalyticsUrl: jest.fn(() => null),
  getAppInfo: () => ({ version: '1.0.0', platform: 'ios' }),
}));

const sentry = jest.mocked(Sentry);
const mockedDsn = jest.mocked(getSentryDsn);

beforeEach(() => {
  jest.clearAllMocks();
  resetMonitoringForTests();
});

afterAll(() => resetMonitoringForTests());

test('is a no-op without a DSN', () => {
  mockedDsn.mockReturnValue(null);

  initMonitoring();
  logger.error('Something failed', new Error('boom'));

  expect(sentry.init).not.toHaveBeenCalled();
  expect(sentry.captureException).not.toHaveBeenCalled();
});

test('initialises Sentry once with privacy-first options', () => {
  mockedDsn.mockReturnValue('https://public@o0.ingest.sentry.io/1');

  initMonitoring();
  initMonitoring();

  expect(sentry.init).toHaveBeenCalledTimes(1);
  expect(sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn: 'https://public@o0.ingest.sentry.io/1',
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      profilesSampleRate: 0,
      beforeSend: scrubEvent,
      beforeSendTransaction: scrubTransaction,
      beforeBreadcrumb: scrubBreadcrumb,
    }),
  );
  const options = sentry.init.mock.calls[0][0] as { tracesSampleRate: number };
  expect(options.tracesSampleRate).toBeLessThanOrEqual(0.1);
});

test('forwards logger.error to Sentry with safe tags only', () => {
  mockedDsn.mockReturnValue('https://public@o0.ingest.sentry.io/1');
  initMonitoring();
  const error = new Error('db failed');

  logger.error('Could not save entry', error, { table: 'journal_entries', attempt: 2 });

  expect(sentry.captureException).toHaveBeenCalledWith(error, {
    tags: { message: 'Could not save entry', table: 'journal_entries', attempt: 2 },
  });
});

test('a failing Sentry init never crashes the app', () => {
  mockedDsn.mockReturnValue('https://public@o0.ingest.sentry.io/1');
  sentry.init.mockImplementationOnce(() => {
    throw new Error('native module missing');
  });

  expect(() => initMonitoring()).not.toThrow();
  logger.error('after failed init', new Error('x'));
  expect(sentry.captureException).not.toHaveBeenCalled();
});
