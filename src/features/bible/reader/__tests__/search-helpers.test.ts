import { buildSearchSuggestions, parseSnippet } from '@/features/bible/reader/search-helpers';
import { parseReference } from '@/features/bible/reference';
import type { DiscoverTopic } from '@/features/bible/types';
import { idsToRange } from '@/features/bible/verse-id';

jest.mock('@/features/bible/reference', () => ({ parseReference: jest.fn(() => null) }));

const TOPICS: DiscoverTopic[] = [
  { id: 'forgiveness', title: 'Forgiveness', description: 'Mercy received and given', cards: [] },
  { id: 'peace', title: 'Peace', description: 'Rest for anxious hearts', cards: [] },
];

describe('parseSnippet', () => {
  test('splits «matches» from plain text', () => {
    expect(parseSnippet('Blessed are the «peace»makers, for «they»')).toEqual([
      { text: 'Blessed are the ', isMatch: false },
      { text: 'peace', isMatch: true },
      { text: 'makers, for ', isMatch: false },
      { text: 'they', isMatch: true },
    ]);
  });

  test('tolerates unbalanced or empty markers', () => {
    expect(parseSnippet('no markers')).toEqual([{ text: 'no markers', isMatch: false }]);
    expect(parseSnippet('open «only')).toEqual([{ text: 'open only', isMatch: false }]);
    expect(parseSnippet('«»empty')).toEqual([{ text: 'empty', isMatch: false }]);
    expect(parseSnippet('')).toEqual([]);
  });
});

describe('buildSearchSuggestions', () => {
  test('nothing for an empty query', () => {
    expect(buildSearchSuggestions('  ', TOPICS)).toEqual({ reference: null, books: [], topics: [] });
  });

  test('parsed reference, matching books and topics', () => {
    const range = idsToRange(45_008_028);
    jest.mocked(parseReference).mockReturnValueOnce(range);

    const suggestions = buildSearchSuggestions('Romans 8:28', TOPICS);

    expect(suggestions.reference).toEqual(range);
    expect(suggestions.books.map((b) => b.name)).toEqual(['Romans']);
    expect(buildSearchSuggestions('peace', TOPICS).topics.map((t) => t.id)).toEqual(['peace']);
    expect(buildSearchSuggestions('forgiveness of sins', TOPICS).topics.map((t) => t.id)).toEqual(['forgiveness']);
  });

  test('limits book suggestions', () => {
    expect(buildSearchSuggestions('1', TOPICS).books.length).toBeLessThanOrEqual(4);
  });
});
