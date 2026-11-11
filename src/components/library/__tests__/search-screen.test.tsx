import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import SearchScreen from '@/app/search';
import { db } from '@/db/client';
import { seedJournalEntry, seedPrayer, seedReference, seedSavedVerse, seedSermon, seedTag } from '@/features/library/testing/fixtures';
import { track } from '@/services/monitoring/analytics';

// Screen tests render real RN trees; the first render can be slow under coverage instrumentation.
jest.setTimeout(30_000);

jest.mock('expo-sqlite', () => jest.requireActual('@/features/library/testing/live-db-mocks').expoSqliteMock);
jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/repository', () => ({
  searchBible: jest.fn(async (query: string) => (!query.includes('forgiv') ? [] : [
    {
      verse: { id: 40006014, bookId: 40, chapter: 6, verse: 14, text: 'For if you forgive men their trespasses', heading: null, paragraphStart: false, poetry: false },
      snippet: '',
    },
  ])),
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SearchScreen />
    </QueryClientProvider>,
  );
}

async function typeQuery(text: string) {
  await fireEvent.changeText(screen.getByRole('search', { name: 'Search your library' }), text);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
  // Let the Bible-text query resolve and TanStack Query flush its batched (setTimeout 0) updates.
  for (let step = 0; step < 3; step += 1) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
  }
}

beforeAll(() => {
  seedJournalEntry(db, { title: 'Learning forgiveness', content: 'It takes time.' });
  for (let index = 0; index < 7; index += 1) seedPrayer(db, { title: `Forgiveness prayer ${index}` });
  seedSermon(db, { title: 'The Power of Forgiveness', speaker: 'Pastor John' });
  const tagged = seedJournalEntry(db, { title: 'Hard talk' });
  seedTag(db, 'forgiveness', [{ entityType: 'journal_entry', entityId: tagged }]);
  seedSavedVerse(db, { startVerseId: 40006014, endVerseId: 40006015 });
  const onRomans = seedJournalEntry(db, { title: 'All things work together' });
  seedReference(db, { sourceType: 'journal_entry', sourceId: onRomans, startVerseId: 45008028, endVerseId: 45008028 });
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

describe('universal search screen', () => {
  it('explains what can be searched before typing', async () => {
    await renderScreen();
    expect(screen.getByText(/Your search stays on this device/)).toBeTruthy();
  });

  it('groups results by type, shows more on demand and tracks only the count', async () => {
    await renderScreen();
    await typeQuery('forgiveness');

    expect(screen.getByRole('header', { name: 'Journal' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Prayers' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Sermons' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /The Power of Forgiveness, Pastor John/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /forgiveness · 1/ })).toBeTruthy();
    expect(await screen.findByRole('header', { name: 'Saved verses & highlights' })).toBeTruthy();

    expect(screen.queryByText('Forgiveness prayer 1')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Show more prayers' }));
    expect(screen.getByText('Forgiveness prayer 1')).toBeTruthy();

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({ name: 'library_search_performed', resultCount: expect.any(Number) });
    expect(JSON.stringify(jest.mocked(track).mock.calls)).not.toContain('forgiveness');

    await fireEvent.press(screen.getByRole('button', { name: /^Learning forgiveness/ }));
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/journal\//));
  });

  it('opens a Bible reference and lists what references it', async () => {
    await renderScreen();
    await typeQuery('Romans 8:28');
    expect(screen.getByText('Romans 8:28')).toBeTruthy();
    expect(screen.getByRole('button', { name: /All things work together/ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Read Romans 8:28' }));
    expect(router.push).toHaveBeenCalledWith('/bible/read/45/8?verse=28');
  });

  it('shows a calm empty state', async () => {
    await renderScreen();
    await typeQuery('zzzqqq');
    expect(screen.getByText('Nothing found')).toBeTruthy();
  });

  it('searches for a tag when its chip is pressed', async () => {
    await renderScreen();
    await typeQuery('forgiv');
    await fireEvent.press(screen.getByRole('button', { name: /forgiveness · 1/ }));
    expect(screen.getByDisplayValue('forgiveness')).toBeTruthy();
  });
});
