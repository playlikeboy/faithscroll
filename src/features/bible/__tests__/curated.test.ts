import { getBook } from '@/features/bible/books';
import { DISCOVER_TOPICS, getDiscoverTopic, getVerseOfTheDay } from '@/features/bible/curated';
import { DISCOVER_TOPIC_SOURCES } from '@/features/bible/data/discover-topics';
import { VERSE_OF_THE_DAY_REFERENCES } from '@/features/bible/data/verse-of-the-day';
import { installBundledBibleForTests } from '@/features/bible/db/testing/node-executor';
import { formatReference, parseReference } from '@/features/bible/reference';
import { getVerses } from '@/features/bible/repository';
import type { VerseRange } from '@/features/bible/types';
import { rangeToIds } from '@/features/bible/verse-id';

const MAX_VOTD_VERSES = 4;
const PRD_TOPICS = ['Faith', 'Hope', 'Love', 'Forgiveness', 'Wisdom', 'Patience', 'Courage', 'Peace', 'Gratitude', 'Purpose'];

let restore: () => void;
beforeAll(() => {
  restore = installBundledBibleForTests();
});
afterAll(() => restore());

function versesIn(range: VerseRange): number {
  return range.end.verse - range.start.verse + 1;
}

async function expectRangeInBible(range: VerseRange): Promise<void> {
  const verses = await getVerses(range);
  expect({ ref: formatReference(range), count: verses.length }).toEqual({ ref: formatReference(range), count: versesIn(range) });
  expect(verses.every((verse) => verse.text.length > 0)).toBe(true);
}

describe('Verse of the Day rotation', () => {
  const ranges = VERSE_OF_THE_DAY_REFERENCES.map((ref) => ({ ref, range: parseReference(ref) }));

  test('has at least 120 unique passages that all parse', () => {
    expect(ranges.length).toBeGreaterThanOrEqual(120);
    expect(ranges.filter(({ range }) => range === null).map(({ ref }) => ref)).toEqual([]);
    const ids = ranges.map(({ range }) => JSON.stringify(range && rangeToIds(range)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('mixes Old and New Testament passages and keeps them short', () => {
    const books = ranges.map(({ range }) => getBook(range?.start.bookId ?? 0));
    expect(books.filter((book) => book?.testament === 'OT').length).toBeGreaterThanOrEqual(40);
    expect(books.filter((book) => book?.testament === 'NT').length).toBeGreaterThanOrEqual(40);
    for (const { range } of ranges) {
      expect(range?.start.chapter).toBe(range?.end.chapter);
      expect(versesIn(range as VerseRange)).toBeLessThanOrEqual(MAX_VOTD_VERSES);
    }
  });

  test('every passage exists in bible.db', async () => {
    for (const { range } of ranges) await expectRangeInBible(range as VerseRange);
  });

  test('is deterministic by local day of the year', () => {
    const morning = getVerseOfTheDay(new Date(2026, 10, 11, 6, 0));
    const night = getVerseOfTheDay(new Date(2026, 10, 11, 23, 59));
    expect(morning).toEqual(night);
    expect(getVerseOfTheDay(new Date(2027, 10, 11, 12))).toEqual(morning);
    expect(getVerseOfTheDay(new Date(2026, 0, 1))).toEqual(parseReference(VERSE_OF_THE_DAY_REFERENCES[0]));
    expect(getVerseOfTheDay(new Date(2026, 0, 2))).toEqual(parseReference(VERSE_OF_THE_DAY_REFERENCES[1]));
    expect(getVerseOfTheDay(new Date(2026, 11, 31))).toEqual(
      parseReference(VERSE_OF_THE_DAY_REFERENCES[(365 - 1) % VERSE_OF_THE_DAY_REFERENCES.length]),
    );
  });

  test('consecutive days differ', () => {
    for (let day = 1; day < 60; day += 1) {
      expect(getVerseOfTheDay(new Date(2026, 0, day))).not.toEqual(getVerseOfTheDay(new Date(2026, 0, day + 1)));
    }
  });

  test('falls back to a valid passage for an invalid date', () => {
    expect(getVerseOfTheDay(new Date(Number.NaN))).toEqual(parseReference(VERSE_OF_THE_DAY_REFERENCES[0]));
  });
});

describe('Discover topics', () => {
  test('are the ten PRD topics in order', () => {
    expect(DISCOVER_TOPICS.map((topic) => topic.title)).toEqual(PRD_TOPICS);
    expect(DISCOVER_TOPICS.map((topic) => topic.id)).toEqual(PRD_TOPICS.map((title) => title.toLowerCase()));
    for (const topic of DISCOVER_TOPICS) expect(topic.description.length).toBeGreaterThan(10);
  });

  test('every source reference parses (no card is silently dropped)', () => {
    DISCOVER_TOPIC_SOURCES.forEach((source, index) => {
      expect(source.cards.filter((card) => parseReference(card.ref) === null).map((card) => card.ref)).toEqual([]);
      expect(DISCOVER_TOPICS[index].cards).toHaveLength(source.cards.length);
    });
  });

  test('each topic has 8 to 10 cards with unique ids', () => {
    const ids = DISCOVER_TOPICS.flatMap((topic) => topic.cards.map((card) => card.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of DISCOVER_TOPICS) {
      expect(topic.cards.length).toBeGreaterThanOrEqual(8);
      expect(topic.cards.length).toBeLessThanOrEqual(10);
    }
  });

  test('context is one or two sentences', () => {
    for (const card of DISCOVER_TOPICS.flatMap((topic) => topic.cards)) {
      const sentences = card.context.match(/[.!?](?=\s+[A-Z“]|$)/g) ?? [];
      expect({ id: card.id, sentences: sentences.length >= 1 && sentences.length <= 2 }).toEqual({ id: card.id, sentences: true });
      expect(card.context.length).toBeLessThan(260);
    }
  });

  test('every card passage exists in bible.db', async () => {
    for (const card of DISCOVER_TOPICS.flatMap((topic) => topic.cards)) await expectRangeInBible(card.range);
  });

  test('looks topics up by id', () => {
    expect(getDiscoverTopic('hope')?.title).toBe('Hope');
    expect(getDiscoverTopic('unknown')).toBeUndefined();
  });
});
