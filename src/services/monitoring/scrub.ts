/**
 * Privacy scrubbing for crash reports. Faithscroll never sends prayers, journal text, notes,
 * transcripts or search queries anywhere — including inside error messages, URLs or breadcrumbs.
 * Strategy: allowlist what is useful for debugging, drop everything else.
 */
import type { Breadcrumb, ErrorEvent, Event, TransactionEvent } from '@sentry/react-native';

const MAX_TEXT_LENGTH = 300;
const MAX_TAG_LENGTH = 120;
const MAX_TAGS = 20;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** Drizzle/SQLite errors append bound parameters (which can be user text) after `params:`. */
const SQL_PARAMS_PATTERN = /\bparams:[\s\S]*$/i;
const KEPT_CONTEXTS = new Set(['app', 'device', 'os', 'runtime', 'trace', 'react_native_context']);
const HTTP_CATEGORIES = new Set(['fetch', 'xhr', 'http']);

type Primitive = string | number | boolean;

/** Remove things that could carry user content from free-form text. */
export function scrubText(text: string): string {
  const withoutParams = text.replace(SQL_PARAMS_PATTERN, 'params: [redacted]');
  const withoutEmails = withoutParams.replace(EMAIL_PATTERN, '[email]');
  return withoutEmails.length > MAX_TEXT_LENGTH ? `${withoutEmails.slice(0, MAX_TEXT_LENGTH)}…` : withoutEmails;
}

/** Drop query strings and fragments (search terms, tokens, PostgREST filters). */
export function sanitizeUrl(url: string): string {
  return url.split(/[?#]/)[0] ?? '';
}

/** Keep only short primitive tags. */
export function safeTags(tags: Record<string, unknown> | undefined): Record<string, Primitive> {
  if (!tags) return {};
  const entries = Object.entries(tags)
    .filter((entry): entry is [string, Primitive] => ['string', 'number', 'boolean'].includes(typeof entry[1]))
    .slice(0, MAX_TAGS)
    .map(([key, value]) => [key, typeof value === 'string' ? scrubText(value).slice(0, MAX_TAG_LENGTH) : value]);
  return Object.fromEntries(entries);
}

function definedOnly<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const category = breadcrumb.category ?? '';
  // Console output and touch/UI breadcrumbs can contain on-screen text (titles, labels).
  if (category === 'console' || category === 'touch' || category.startsWith('ui.')) return null;

  const data = breadcrumb.data ?? {};
  if (HTTP_CATEGORIES.has(category) || breadcrumb.type === 'http') {
    return {
      ...breadcrumb,
      message: undefined,
      data: definedOnly({
        method: typeof data.method === 'string' ? data.method : undefined,
        status_code: typeof data.status_code === 'number' ? data.status_code : undefined,
        url: typeof data.url === 'string' ? sanitizeUrl(data.url) : undefined,
      }),
    };
  }
  if (category === 'navigation') {
    return {
      ...breadcrumb,
      message: breadcrumb.message ? sanitizeUrl(breadcrumb.message) : undefined,
      data: definedOnly({
        from: typeof data.from === 'string' ? sanitizeUrl(data.from) : undefined,
        to: typeof data.to === 'string' ? sanitizeUrl(data.to) : undefined,
      }),
    };
  }
  return { ...breadcrumb, message: breadcrumb.message ? scrubText(breadcrumb.message) : undefined, data: undefined };
}

function scrubContexts(contexts: Event['contexts']): Event['contexts'] {
  if (!contexts) return undefined;
  const kept = Object.entries(contexts).filter(([key]) => KEPT_CONTEXTS.has(key));
  return Object.fromEntries(
    kept.map(([key, value]) => {
      if (key !== 'device' || !value) return [key, value];
      const { name: _deviceName, ...device } = value as Record<string, unknown>;
      return [key, device];
    }),
  ) as Event['contexts'];
}

function scrubCommon<T extends Event>(event: T): T {
  const { user: _user, extra: _extra, request, breadcrumbs, exception, message, contexts, tags, transaction, ...rest } =
    event;
  const scrubbed: Event = {
    ...rest,
    ...(transaction ? { transaction: sanitizeUrl(transaction) } : {}),
    ...(message ? { message: scrubText(message) } : {}),
    ...(request?.url || request?.method
      ? { request: definedOnly({ url: request.url ? sanitizeUrl(request.url) : undefined, method: request.method }) }
      : {}),
    ...(exception
      ? {
          exception: {
            ...exception,
            values: exception.values?.map((value) => ({ ...value, value: value.value ? scrubText(value.value) : value.value })),
          },
        }
      : {}),
    ...(breadcrumbs ? { breadcrumbs: breadcrumbs.map(scrubBreadcrumb).filter((b): b is Breadcrumb => b !== null) } : {}),
    ...(contexts ? { contexts: scrubContexts(contexts) } : {}),
    ...(tags ? { tags: safeTags(tags) } : {}),
  };
  return scrubbed as T;
}

/** Sentry `beforeSend`: errors. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  return scrubCommon(event);
}

/** Sentry `beforeSendTransaction`: performance events (span URLs can carry search terms). */
export function scrubTransaction(event: TransactionEvent): TransactionEvent {
  const scrubbed = scrubCommon(event);
  if (!scrubbed.spans) return scrubbed;
  return {
    ...scrubbed,
    spans: scrubbed.spans.map((span) => {
      const data = { ...(span.data ?? {}) } as Record<string, unknown>;
      delete data['http.query'];
      delete data['http.fragment'];
      if (typeof data.url === 'string') data.url = sanitizeUrl(data.url);
      if (typeof data['http.url'] === 'string') data['http.url'] = sanitizeUrl(data['http.url'] as string);
      return { ...span, description: span.description ? sanitizeUrl(span.description) : span.description, data };
    }),
  } as TransactionEvent;
}
