import { getVerseOfTheDay } from '@/features/bible/curated';
import type { VerseRange } from '@/features/bible/types';
import {
  buildVerseWidgetTimeline,
  startOfLocalDay,
  verseDeepLink,
  WIDGET_TIMELINE_DAYS,
} from '@/features/widgets/verse-widget-timeline';

const NOW = new Date(2026, 10, 11, 15, 42);
const loadText = jest.fn(async (range: VerseRange) => `text ${range.start.bookId}:${range.start.chapter}:${range.start.verse}`);

beforeEach(() => loadText.mockClear());

describe('buildVerseWidgetTimeline', () => {
  test('returns one entry per day starting at local midnight today', async () => {
    const entries = await buildVerseWidgetTimeline(NOW, WIDGET_TIMELINE_DAYS, loadText);

    expect(entries).toHaveLength(14);
    expect(entries[0].date).toEqual(new Date(2026, 10, 11));
    expect(entries[13].date).toEqual(new Date(2026, 10, 24));
  });

  test('uses each day’s Verse of the Day with its text, reference, translation and deep link', async () => {
    const [today] = await buildVerseWidgetTimeline(NOW, 1, loadText);
    const range = getVerseOfTheDay(new Date(2026, 10, 11));

    expect(today.props.text).toBe(`text ${range.start.bookId}:${range.start.chapter}:${range.start.verse}`);
    expect(today.props.reference).not.toBe('');
    expect(today.props.translation).toBe('WEB');
    expect(today.props.url).toBe(verseDeepLink(range));
  });

  test('falls back to a gentle prompt when a verse cannot be read', async () => {
    const failing = jest.fn(async () => {
      throw new Error('bible.db not ready');
    });

    const [today] = await buildVerseWidgetTimeline(NOW, 1, failing);

    expect(today.props.text).toMatch(/Open Faithscroll/);
  });

  test('returns nothing for zero days', async () => {
    expect(await buildVerseWidgetTimeline(NOW, 0, loadText)).toEqual([]);
  });
});

describe('helpers', () => {
  test('startOfLocalDay crosses month ends', () => {
    expect(startOfLocalDay(new Date(2026, 10, 30, 23, 59), 1)).toEqual(new Date(2026, 11, 1));
  });

  test('verseDeepLink opens the reader at the first verse of the range', () => {
    const range: VerseRange = { start: { bookId: 45, chapter: 8, verse: 28 }, end: { bookId: 45, chapter: 8, verse: 30 } };
    expect(verseDeepLink(range)).toBe('faithscroll:///bible/read/45/8?verse=28');
  });
});
