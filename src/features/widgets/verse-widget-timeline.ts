import { getVerseOfTheDay } from '@/features/bible/curated';
import { formatReference } from '@/features/bible/reference';
import { DEFAULT_TRANSLATION, getVerses } from '@/features/bible/repository';
import type { VerseRange } from '@/features/bible/types';

/** Days of verses handed to the widget so it keeps changing daily even if the app isn't opened. */
export const WIDGET_TIMELINE_DAYS = 14;

/** Text shown when a verse can't be read (e.g. the Bible database isn't ready yet). */
const FALLBACK_TEXT = 'Open Faithscroll to read today’s verse.';

export interface VerseWidgetProps {
  reference: string;
  text: string;
  translation: string;
  url: string;
}

export interface VerseWidgetEntry {
  date: Date;
  props: VerseWidgetProps;
}

export type LoadVerseText = (range: VerseRange) => Promise<string>;

async function loadFromBible(range: VerseRange): Promise<string> {
  const verses = await getVerses(range);
  return verses.map((verse) => verse.text).join(' ');
}

/** Local midnight `offsetDays` after `now`. */
export function startOfLocalDay(now: Date, offsetDays = 0): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
}

/** Deep link into the reader at the verse (custom scheme from app.json). */
export function verseDeepLink(range: VerseRange): string {
  const { bookId, chapter, verse } = range.start;
  return `faithscroll:///bible/read/${bookId}/${chapter}?verse=${verse}`;
}

/** One entry per local day starting today, oldest first. Never rejects: unreadable days get a fallback. */
export async function buildVerseWidgetTimeline(
  now: Date = new Date(),
  days: number = WIDGET_TIMELINE_DAYS,
  loadText: LoadVerseText = loadFromBible,
): Promise<VerseWidgetEntry[]> {
  const offsets = Array.from({ length: Math.max(0, days) }, (_, index) => index);
  return Promise.all(
    offsets.map(async (offset) => {
      const date = startOfLocalDay(now, offset);
      const range = getVerseOfTheDay(date);
      const text = await loadText(range).catch(() => '');
      return {
        date,
        props: {
          reference: formatReference(range) || 'Verse of the Day',
          text: text.trim() || FALLBACK_TEXT,
          translation: DEFAULT_TRANSLATION.abbreviation,
          url: verseDeepLink(range),
        },
      };
    }),
  );
}
