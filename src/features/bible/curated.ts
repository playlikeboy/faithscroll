/**
 * Curated, human-written content: Verse of the Day rotation and Discover topics.
 * Owned by the bible-data agent; exported signatures are a shared contract.
 * Content lives in ./data (references as text, checked against the bundled Bible by tests).
 */
import { getBook } from './books';
import { DISCOVER_TOPIC_SOURCES } from './data/discover-topics';
import { VERSE_OF_THE_DAY_REFERENCES } from './data/verse-of-the-day';
import { parseReference } from './reference';
import type { DiscoverCard, DiscoverTopic, VerseRange } from './types';

const MS_PER_DAY = 86_400_000;
const FALLBACK_VERSE: VerseRange = {
  start: { bookId: 19, chapter: 23, verse: 1 },
  end: { bookId: 19, chapter: 23, verse: 1 },
};

const VERSE_OF_THE_DAY: readonly VerseRange[] = VERSE_OF_THE_DAY_REFERENCES.map(parseReference).filter(
  (range): range is VerseRange => range !== null,
);

/** 1 for 1 January, using the device's local calendar date (DST-safe). */
function localDayOfYear(date: Date): number {
  const year = date.getFullYear();
  const today = Date.UTC(year, date.getMonth(), date.getDate());
  return Math.round((today - Date.UTC(year, 0, 1)) / MS_PER_DAY) + 1;
}

/** Deterministic Verse of the Day for a local calendar date (works offline). */
export function getVerseOfTheDay(date: Date): VerseRange {
  if (VERSE_OF_THE_DAY.length === 0 || Number.isNaN(date.getTime())) return VERSE_OF_THE_DAY[0] ?? FALLBACK_VERSE;
  return VERSE_OF_THE_DAY[(localDayOfYear(date) - 1) % VERSE_OF_THE_DAY.length];
}

function cardId(topicId: string, range: VerseRange): string {
  const code = getBook(range.start.bookId)?.code.toLowerCase() ?? String(range.start.bookId);
  return `${topicId}-${code}-${range.start.chapter}-${range.start.verse}`;
}

function toCards(topicId: string, sources: readonly { ref: string; context: string }[]): DiscoverCard[] {
  return sources.flatMap(({ ref, context }) => {
    const range = parseReference(ref);
    return range ? [{ id: cardId(topicId, range), range, context }] : [];
  });
}

export const DISCOVER_TOPICS: readonly DiscoverTopic[] = DISCOVER_TOPIC_SOURCES.map(({ id, title, description, cards }) => ({
  id,
  title,
  description,
  cards: toCards(id, cards),
}));

export function getDiscoverTopic(id: string): DiscoverTopic | undefined {
  return DISCOVER_TOPICS.find((topic) => topic.id === id);
}
