import { AppState } from 'react-native';

import { logger } from '@/lib/logger';
import {
  resetAnalyticsIdentity,
  setAnalyticsEnabled,
  track,
  type AnalyticsEvent,
} from '@/services/monitoring/analytics';
import { useAnalyticsConsent } from '@/services/monitoring/analytics-consent';
import { validateAnalyticsEvent } from '@/services/monitoring/analytics-events';
import {
  FLUSH_INTERVAL_MS,
  MAX_BATCH_SIZE,
  flushAnalytics,
  getQueuedEventCount,
  resetAnalyticsTransportForTests,
} from '@/services/monitoring/analytics-transport';
import { getAnalyticsUrl } from '@/services/monitoring/config';

jest.mock('@/services/monitoring/config', () => ({
  getAnalyticsUrl: jest.fn(() => null),
  getSentryDsn: jest.fn(() => null),
  getAppInfo: () => ({ version: '1.0.0', platform: 'ios' }),
}));

const mockedUrl = jest.mocked(getAnalyticsUrl);
const ENDPOINT = 'https://analytics.example.com/v1/events';
const fetchMock = jest.fn();

function sentBodies(): { installId: string; sessionId: string; events: { name: string; props: object }[] }[] {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body));
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetAnalyticsTransportForTests();
  await useAnalyticsConsent.persist.rehydrate();
  useAnalyticsConsent.setState({ enabled: true, installId: null });
  mockedUrl.mockReturnValue(null);
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  resetAnalyticsTransportForTests();
});

describe('validateAnalyticsEvent', () => {
  test.each<AnalyticsEvent>([
    { name: 'verse_saved' },
    { name: 'chapter_opened', bookId: 43, chapter: 3 },
    { name: 'onboarding_completed', goal: null },
    { name: 'onboarding_completed', goal: 'daily_chapter' },
    { name: 'study_opened', mode: 'deep' },
    { name: 'plan_day_completed', planId: 'john-21', day: 4 },
    { name: 'purchase_completed', productId: 'app.faithscroll.plus.yearly' },
    { name: 'recording_saved', durationSec: 2712.4 },
  ])('accepts %o', (event) => {
    expect(validateAnalyticsEvent(event)).toEqual(event);
  });

  test.each<[unknown, string]>([
    [{ name: 'journal_entry_created', entryType: 'Today I felt far from God' }, 'free text in a string field'],
    [{ name: 'verse_saved', text: 'For God so loved the world' }, 'extra keys'],
    [{ name: 'bible_search_performed', resultCount: 3, query: 'grief' }, 'search query smuggled in'],
    [{ name: 'chapter_opened', bookId: 43, chapter: -1 }, 'invalid numbers'],
    [{ name: 'not_an_event' }, 'unknown name'],
    [{ name: 'discover_session_started', topicId: 'x'.repeat(65) }, 'over-long identifier'],
    [null, 'null'],
  ])('rejects %o (%s)', (event: unknown) => {
    expect(validateAnalyticsEvent(event)).toBeNull();
  });
});

describe('track', () => {
  test('never leaves the device without an endpoint (debug log only)', () => {
    const debug = jest.spyOn(logger, 'debug');

    track({ name: 'verse_saved' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('analytics: verse_saved');
  });

  test('drops invalid events and logs only the event name', () => {
    mockedUrl.mockReturnValue(ENDPOINT);
    const warn = jest.spyOn(logger, 'warn');

    track({ name: 'journal_entry_created', entryType: 'my secret reflection' });

    expect(getQueuedEventCount()).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { name: 'journal_entry_created' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
  });

  test('respects the opt-out', async () => {
    mockedUrl.mockReturnValue(ENDPOINT);
    setAnalyticsEnabled(false);

    track({ name: 'verse_saved' });
    await flushAnalytics();

    expect(getQueuedEventCount()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useAnalyticsConsent.getState().installId).toBeNull();
  });

  test('opting out discards events that were queued but not yet sent', async () => {
    mockedUrl.mockReturnValue(ENDPOINT);
    track({ name: 'verse_saved' });
    expect(getQueuedEventCount()).toBe(1);

    setAnalyticsEnabled(false);
    await flushAnalytics();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('batches events with an anonymous install id and no user id', async () => {
    mockedUrl.mockReturnValue(ENDPOINT);

    track({ name: 'chapter_opened', bookId: 19, chapter: 23 });
    track({ name: 'recording_saved', durationSec: 61.6 });
    await flushAnalytics();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const body = sentBodies()[0];
    expect(body).toMatchObject({ app: { version: '1.0.0', platform: 'ios' } });
    expect(body.installId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body).not.toHaveProperty('userId');
    expect(body.events).toEqual([
      expect.objectContaining({ name: 'chapter_opened', props: { bookId: 19, chapter: 23 } }),
      expect.objectContaining({ name: 'recording_saved', props: { durationSec: 62 } }),
    ]);
  });

  test('flushes automatically when a batch is full', async () => {
    mockedUrl.mockReturnValue(ENDPOINT);

    for (let i = 0; i < MAX_BATCH_SIZE; i += 1) track({ name: 'verse_highlighted' });
    await flushAnalytics();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBodies()[0].events).toHaveLength(MAX_BATCH_SIZE);
  });

  test('flushes on a timer and when the app goes to the background', async () => {
    jest.useFakeTimers();
    mockedUrl.mockReturnValue(ENDPOINT);
    const addListener = jest.spyOn(AppState, 'addEventListener');

    track({ name: 'verse_saved' });
    await jest.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    track({ name: 'prayer_created' });
    const onChange = addListener.mock.calls[0]?.[1] as ((state: string) => void) | undefined;
    onChange?.('background');
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('re-queues a failed batch once, then drops it', async () => {
    mockedUrl.mockReturnValue(ENDPOINT);
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    track({ name: 'verse_saved' });
    await flushAnalytics();
    expect(getQueuedEventCount()).toBe(1);

    await flushAnalytics();
    expect(getQueuedEventCount()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('resetAnalyticsIdentity replaces the install id but keeps the choice', async () => {
    mockedUrl.mockReturnValue(ENDPOINT);
    track({ name: 'verse_saved' });
    await flushAnalytics();
    const firstId = sentBodies()[0].installId;

    resetAnalyticsIdentity();
    track({ name: 'verse_saved' });
    await flushAnalytics();

    expect(useAnalyticsConsent.getState().enabled).toBe(true);
    expect(sentBodies()[1].installId).not.toBe(firstId);
  });
});
