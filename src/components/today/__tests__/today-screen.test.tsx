import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TodayScreen } from '@/components/today/today-screen';
import { db } from '@/db/client';
import { journalEntries, readingProgress, savedVerses, sermons } from '@/db/schema';
import { track } from '@/services/monitoring/analytics';

const mockRouter = { push: jest.fn(), navigate: jest.fn() };

// Screen-level suites render a lot on a cold start; allow headroom on a busy machine.
jest.setTimeout(20_000);

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
// Live queries read synchronously from the in-memory test database.
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all(), error: undefined, updatedAt: undefined }),
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/reference', () => ({ formatReference: () => 'Psalm 23:1' }));
// Pin the rotation so the test does not depend on today's date.
jest.mock('@/features/bible/curated', () => ({
  ...jest.requireActual('@/features/bible/curated'),
  getVerseOfTheDay: () => ({ start: { bookId: 19, chapter: 23, verse: 1 }, end: { bookId: 19, chapter: 23, verse: 1 } }),
}));
jest.mock('@/features/bible/repository', () => ({
  ...jest.requireActual('@/features/bible/repository'),
  getVerses: jest.fn(async () => [
    {
      id: 19_023_001,
      bookId: 19,
      chapter: 23,
      verse: 1,
      text: 'Yahweh is my shepherd; I shall lack nothing.',
      heading: null,
      paragraphStart: true,
      poetry: true,
    },
  ]),
}));

async function renderToday() {
  // gcTime: Infinity avoids lingering garbage-collection timers after the test ends.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <TodayScreen />
    </QueryClientProvider>,
  );
}

describe('TodayScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const table of [savedVerses, journalEntries, sermons, readingProgress]) db.delete(table).run();
  });

  test('is useful with an empty library', async () => {
    await renderToday();

    expect(screen.getByText(/^Good (morning|afternoon|evening)$/)).toBeTruthy();
    expect(await screen.findByText('Yahweh is my shepherd; I shall lack nothing.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start with John 1' })).toBeTruthy();
    expect(screen.getByText(/will gather here/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start with John 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start a sermon' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Read the Bible' }));
    expect(mockRouter.push.mock.calls.map(([href]) => href)).toEqual(['/settings', '/bible/read/43/1', '/sermons/new']);
    expect(mockRouter.navigate).toHaveBeenCalledWith('/bible');
  });

  test('resumes reading and lists recent activity from the database', async () => {
    db.insert(readingProgress).values({ translationId: 'WEB', bookId: 43, chapter: 3, verse: 16 }).run();
    db.insert(sermons).values({ id: 'sermon-1', title: 'The Power of Forgiveness' }).run();

    await renderToday();

    expect(screen.getByText('John 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/bible/read/43/3?verse=16');

    await fireEvent.press(screen.getByRole('button', { name: /^The Power of Forgiveness, Sermon/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sermons/sermon-1');
  });

  test('saves the verse of the day and a reflection', async () => {
    await renderToday();
    await screen.findByText('Yahweh is my shepherd; I shall lack nothing.');

    await fireEvent.press(screen.getByRole('button', { name: 'Save Psalm 23:1' }));
    expect(db.select().from(savedVerses).all()).toEqual([
      expect.objectContaining({ startVerseId: 19_023_001, endVerseId: 19_023_001 }),
    ]);
    expect(track).toHaveBeenCalledWith({ name: 'verse_saved' });

    await fireEvent.changeText(screen.getByLabelText(/^Reflection\./), 'Grateful for quiet mornings.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save reflection' }));

    expect(screen.getByText('Saved to your journal.')).toBeTruthy();
    expect(db.select().from(journalEntries).all()).toEqual([
      expect.objectContaining({ entryType: 'reflection', content: 'Grateful for quiet mornings.' }),
    ]);
    expect(track).toHaveBeenCalledWith({ name: 'journal_entry_created', entryType: 'reflection' });
  });
});
