import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DiscoverCardView } from '@/components/discover/discover-card';
import { DiscoverSessionScreen } from '@/components/discover/discover-session-screen';
import { SessionEnd } from '@/components/discover/session-end';
import { TopicList } from '@/components/discover/topic-list';
import { db } from '@/db/client';
import { savedVerses } from '@/db/schema';
import type { SessionCard } from '@/features/discover/session';
import { idsToRange } from '@/features/bible/verse-id';
import { track } from '@/services/monitoring/analytics';

const mockRouter = { push: jest.fn(), replace: jest.fn() };

// Screen-level suites render a lot on a cold start; allow headroom on a busy machine.
jest.setTimeout(20_000);

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all(), error: undefined, updatedAt: undefined }),
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));
jest.mock('@/features/bible/repository', () => ({
  ...jest.requireActual('@/features/bible/repository'),
  getVerses: jest.fn(async () => [
    { id: 1, bookId: 45, chapter: 5, verse: 5, text: 'Hope does not disappoint us.', heading: null, paragraphStart: false, poetry: false },
  ]),
}));
jest.mock('@/features/bible/curated', () => {
  const { idsToRange: toRange } = jest.requireActual('@/features/bible/verse-id');
  const topics = [
    {
      id: 'hope',
      title: 'Hope',
      description: 'Hope that holds.',
      cards: [
        { id: 'hope-1', range: toRange(45_005_005), context: 'Paul writes to the church in Rome.' },
        { id: 'hope-2', range: toRange(45_015_013), context: 'A blessing near the end of the letter.' },
      ],
    },
  ];
  return { DISCOVER_TOPICS: topics, getDiscoverTopic: (id: string) => topics.find((topic) => topic.id === id) };
});

const card: SessionCard = {
  id: 'c1',
  range: idsToRange(45_005_005),
  startVerseId: 45_005_005,
  endVerseId: 45_005_005,
  reference: 'Romans 5:5',
  context: 'Paul writes to the church in Rome.',
  text: 'Hope does not disappoint us.',
};

async function renderSession(topicId: string | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <DiscoverSessionScreen topicId={topicId} />
    </QueryClientProvider>,
  );
}

describe('DiscoverCardView', () => {
  test('shows verse, reference, context, topic and position, with save and study', async () => {
    const onToggleSave = jest.fn();
    const onOpenStudy = jest.fn();
    await render(
      <DiscoverCardView
        card={card}
        topicTitle="Hope"
        position={1}
        total={2}
        isSaved={false}
        onToggleSave={onToggleSave}
        onOpenStudy={onOpenStudy}
      />,
    );

    expect(screen.getByText('Hope does not disappoint us.')).toBeTruthy();
    expect(screen.getByText('Romans 5:5')).toBeTruthy();
    expect(screen.getByText('Paul writes to the church in Rome.')).toBeTruthy();
    expect(screen.getByLabelText('Passage 1 of 2')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save Romans 5:5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open study for Romans 5:5' }));
    expect(onToggleSave).toHaveBeenCalled();
    expect(onOpenStudy).toHaveBeenCalled();
  });

  test('explains a missing passage instead of showing an empty card', async () => {
    await render(
      <DiscoverCardView
        card={{ ...card, text: null }}
        topicTitle="Hope"
        position={1}
        total={1}
        isSaved
        onToggleSave={jest.fn()}
        onOpenStudy={jest.fn()}
      />,
    );
    expect(screen.getByText(/isn't available on this device/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Saved\./ })).toBeSelected();
  });
});

describe('SessionEnd and TopicList', () => {
  test('session end offers the chapter and another topic', async () => {
    const onReadChapter = jest.fn();
    const onChooseTopic = jest.fn();
    await render(<SessionEnd chapterLabel="Romans 5" onReadChapter={onReadChapter} onChooseTopic={onChooseTopic} />);

    expect(screen.getByText("You've reached the end of this session")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Read the full chapter' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose another topic' }));
    expect(onReadChapter).toHaveBeenCalled();
    expect(onChooseTopic).toHaveBeenCalled();
  });

  test('topic list shows topics or a calm empty state', async () => {
    const onSelect = jest.fn();
    await render(
      <TopicList topics={[{ id: 'hope', title: 'Hope', description: 'Hope that holds.', cardCount: 2 }]} onSelect={onSelect} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Hope. Hope that holds.. 2 passages' }));
    expect(onSelect).toHaveBeenCalledWith('hope');

    await render(<TopicList topics={[]} onSelect={onSelect} />);
    expect(screen.getByText('Topics are on their way')).toBeTruthy();
  });
});

describe('DiscoverSessionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.delete(savedVerses).run();
  });

  test('runs a finite session that ends with a path into the chapter', async () => {
    await renderSession('hope');

    expect(await screen.findByText('Romans 15:13')).toBeTruthy();
    expect(screen.getByText('Romans 5:5')).toBeTruthy();
    expect(track).toHaveBeenCalledWith({ name: 'discover_session_started', topicId: 'hope' });
    expect(screen.getByText("You've reached the end of this session")).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Save Romans 5:5' }));
    expect(db.select().from(savedVerses).all()).toEqual([expect.objectContaining({ startVerseId: 45_005_005 })]);

    await fireEvent.press(screen.getByRole('button', { name: 'Open study for Romans 15:13' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Read the full chapter' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose another topic' }));
    expect(mockRouter.push.mock.calls.map(([href]) => href)).toEqual([
      '/bible/study/45015013?end=45015013',
      '/bible/read/45/15?verse=13',
    ]);
    expect(mockRouter.replace).toHaveBeenCalledWith('/discover');
  });

  test('handles an unknown topic gracefully', async () => {
    await renderSession('missing');

    expect(screen.getByText("This topic isn't available")).toBeTruthy();
    expect(track).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose another topic' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/discover');
  });
});
