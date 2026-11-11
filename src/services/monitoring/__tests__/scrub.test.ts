import type { Breadcrumb, ErrorEvent, TransactionEvent } from '@sentry/react-native';

import {
  safeTags,
  sanitizeUrl,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
  scrubTransaction,
} from '@/services/monitoring/scrub';

describe('scrubText', () => {
  test('removes SQL parameters that can hold journal or prayer text', () => {
    const message =
      'Failed query: insert into "journal_entries" ("id", "content") values (?, ?)\nparams: 42,Lord, help me forgive my brother';

    const scrubbed = scrubText(message);

    expect(scrubbed).toContain('insert into "journal_entries"');
    expect(scrubbed).not.toContain('forgive my brother');
    expect(scrubbed).toContain('params: [redacted]');
  });

  test('redacts email addresses and truncates long text', () => {
    expect(scrubText('Sign-in failed for grace@example.com')).toBe('Sign-in failed for [email]');
    expect(scrubText('x'.repeat(1000)).length).toBeLessThanOrEqual(301);
  });
});

test('sanitizeUrl drops query strings and fragments', () => {
  expect(sanitizeUrl('https://x.supabase.co/rest/v1/journal_entries?content=ilike.*grief*')).toBe(
    'https://x.supabase.co/rest/v1/journal_entries',
  );
  expect(sanitizeUrl('/search?q=forgiveness#top')).toBe('/search');
});

describe('scrubBreadcrumb', () => {
  test('drops console and touch breadcrumbs (they can contain on-screen text)', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'Saving prayer: healing for mum' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'touch', message: 'Pressed "My private note"' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'button' })).toBeNull();
  });

  test('keeps only method, status and path for HTTP breadcrumbs', () => {
    const crumb: Breadcrumb = {
      category: 'fetch',
      type: 'http',
      message: 'POST body: {"content":"secret"}',
      data: {
        method: 'POST',
        status_code: 201,
        url: 'https://x.supabase.co/rest/v1/prayer_entries?select=*',
        request_body: '{"content":"secret"}',
        response_body: '[]',
      },
    };

    expect(scrubBreadcrumb(crumb)).toEqual({
      category: 'fetch',
      type: 'http',
      message: undefined,
      data: { method: 'POST', status_code: 201, url: 'https://x.supabase.co/rest/v1/prayer_entries' },
    });
  });

  test('navigation keeps route paths without params', () => {
    const scrubbed = scrubBreadcrumb({
      category: 'navigation',
      message: '/journal/new?prompt=What%20am%20I%20struggling%20with',
      data: { from: '/journal', to: '/journal/new?prompt=private', params: { prompt: 'private' } },
    });

    expect(scrubbed).toEqual({
      category: 'navigation',
      message: '/journal/new',
      data: { from: '/journal', to: '/journal/new' },
    });
  });

  test('other breadcrumbs lose their data and get scrubbed messages', () => {
    expect(
      scrubBreadcrumb({ category: 'app.lifecycle', message: 'contact me@test.dev', data: { extra: 'anything' } }),
    ).toEqual({ category: 'app.lifecycle', message: 'contact [email]', data: undefined });
  });
});

describe('scrubEvent', () => {
  const event: ErrorEvent = {
    type: undefined,
    message: 'Note save failed params: my secret note',
    user: { id: 'user-1', email: 'grace@example.com', ip_address: '1.2.3.4' },
    extra: { noteContent: 'Dear Lord…' },
    request: {
      url: 'https://api.example.com/search?q=depression',
      method: 'GET',
      data: { q: 'depression' },
      headers: { Authorization: 'Bearer token' },
      cookies: { session: 'abc' },
      query_string: 'q=depression',
    },
    exception: { values: [{ type: 'Error', value: 'Failed query: select 1\nparams: grief' }] },
    breadcrumbs: [
      { category: 'console', message: 'journal text' },
      { category: 'navigation', message: '/journal' },
    ],
    contexts: {
      app: { app_version: '1.0.0' },
      device: { name: "Grace's iPhone", model: 'iPhone16,1' },
      journal_draft: { text: 'private' },
    },
    tags: { screen: 'journal', nested: { a: 1 } as never, count: 2 },
    transaction: '/journal/new?prompt=hidden',
  };

  test('removes user, extra data, request bodies, headers and cookies', () => {
    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.request).toEqual({ url: 'https://api.example.com/search', method: 'GET' });
  });

  test('scrubs messages, exception values, breadcrumbs, contexts, tags and transaction', () => {
    const scrubbed = scrubEvent(event);

    expect(scrubbed.message).toBe('Note save failed params: [redacted]');
    expect(scrubbed.exception?.values?.[0]?.value).toBe('Failed query: select 1\nparams: [redacted]');
    expect(scrubbed.breadcrumbs).toEqual([{ category: 'navigation', message: '/journal', data: {} }]);
    expect(scrubbed.contexts).toEqual({ app: { app_version: '1.0.0' }, device: { model: 'iPhone16,1' } });
    expect(scrubbed.tags).toEqual({ screen: 'journal', count: 2 });
    expect(scrubbed.transaction).toBe('/journal/new');
  });

  test('does not mutate the original event', () => {
    scrubEvent(event);

    expect(event.extra).toEqual({ noteContent: 'Dear Lord…' });
  });

  test('handles a minimal event', () => {
    expect(scrubEvent({ type: undefined, event_id: 'abc' })).toEqual({ type: undefined, event_id: 'abc' });
  });
});

test('scrubTransaction strips URLs and query data from spans', () => {
  const transaction = {
    type: 'transaction',
    transaction: 'Search',
    spans: [
      {
        span_id: '1',
        trace_id: 't',
        start_timestamp: 0,
        description: 'GET https://x.supabase.co/rest/v1/sermons?title=ilike.*hope*',
        data: { url: 'https://x.supabase.co/rest/v1/sermons?title=ilike.*hope*', 'http.query': '?title=ilike.*hope*' },
      },
    ],
  } as unknown as TransactionEvent;

  const scrubbed = scrubTransaction(transaction);

  expect(scrubbed.spans?.[0]).toMatchObject({
    description: 'GET https://x.supabase.co/rest/v1/sermons',
    data: { url: 'https://x.supabase.co/rest/v1/sermons' },
  });
  expect(scrubbed.spans?.[0]?.data).not.toHaveProperty('http.query');
});

test('safeTags keeps short primitives only', () => {
  expect(safeTags({ a: 'x'.repeat(500), b: 1, c: true, d: { nested: true }, e: undefined })).toEqual({
    a: 'x'.repeat(120),
    b: 1,
    c: true,
  });
  expect(safeTags(undefined)).toEqual({});
});
