import { getVerses } from '@/features/bible/repository';
import type { DiscoverTopic, Verse } from '@/features/bible/types';
import { idsToRange } from '@/features/bible/verse-id';
import { MAX_SESSION_CARDS, findTopic, listTopics, loadSession } from '@/features/discover/session';

jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));
jest.mock('@/features/bible/repository', () => ({ getVerses: jest.fn() }));
jest.mock('@/features/bible/curated', () => {
  const { idsToRange: toRange } = jest.requireActual('@/features/bible/verse-id');
  const topics = [
    {
      id: 'hope',
      title: 'Hope',
      description: 'Hope that does not disappoint.',
      cards: [{ id: 'hope-1', range: toRange(45_005_005), context: 'Paul writes to the church in Rome.' }],
    },
    { id: 'empty', title: 'Empty', description: 'No cards yet.', cards: [] },
  ];
  return { DISCOVER_TOPICS: topics, getDiscoverTopic: (id: string) => topics.find((topic) => topic.id === id) };
});

function verse(text: string): Verse {
  return { id: 1, bookId: 1, chapter: 1, verse: 1, text, heading: null, paragraphStart: false, poetry: false };
}

function topicWith(cardCount: number): DiscoverTopic {
  return {
    id: 'peace',
    title: 'Peace',
    description: 'Peace beyond understanding.',
    cards: Array.from({ length: cardCount }, (_, index) => ({
      id: `peace-${index}`,
      range: idsToRange(50_004_007 + index),
      context: `Context ${index}`,
    })),
  };
}

describe('discover session', () => {
  beforeEach(() => jest.mocked(getVerses).mockReset());

  test('lists only topics that have cards', () => {
    expect(listTopics()).toEqual([
      { id: 'hope', title: 'Hope', description: 'Hope that does not disappoint.', cardCount: 1 },
    ]);
    expect(listTopics([topicWith(25)])[0].cardCount).toBe(MAX_SESSION_CARDS);
  });

  test('finds topics by id', () => {
    expect(findTopic('hope')?.title).toBe('Hope');
    expect(findTopic('missing')).toBeNull();
    expect(findTopic(undefined)).toBeNull();
  });

  test('loads a finite session with verse text and labels', async () => {
    jest.mocked(getVerses).mockResolvedValue([verse('Rejoice in the Lord always.'), verse('Again I will say, rejoice!')]);

    const cards = await loadSession(topicWith(MAX_SESSION_CARDS + 5));

    expect(cards).toHaveLength(MAX_SESSION_CARDS);
    expect(cards[0]).toEqual(
      expect.objectContaining({
        id: 'peace-0',
        reference: 'Philippians 4:7',
        context: 'Context 0',
        startVerseId: 50_004_007,
        endVerseId: 50_004_007,
        text: 'Rejoice in the Lord always. Again I will say, rejoice!',
      }),
    );
  });

  test('keeps the session when one passage fails or is missing', async () => {
    jest
      .mocked(getVerses)
      .mockResolvedValueOnce([verse('Peace I leave with you.')])
      .mockRejectedValueOnce(new Error('disk'))
      .mockResolvedValueOnce([]);

    const cards = await loadSession(topicWith(3));

    expect(cards.map((card) => card.text)).toEqual(['Peace I leave with you.', null, null]);
  });
});
