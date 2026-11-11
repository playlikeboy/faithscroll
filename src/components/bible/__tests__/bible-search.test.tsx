import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { BibleSearch } from '@/components/bible/bible-search';
import { parseReference } from '@/features/bible/reference';
import { searchBible } from '@/features/bible/repository';
import type { BibleSearchResult } from '@/features/bible/types';
import { idsToRange } from '@/features/bible/verse-id';
import { track } from '@/services/monitoring/analytics';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/reference', () => ({ parseReference: jest.fn(() => null), formatReference: () => '' }));
jest.mock('@/features/bible/curated', () => ({
  DISCOVER_TOPICS: [{ id: 'peace', title: 'Peace', description: 'Rest for anxious hearts', cards: [] }],
}));
jest.mock('@/features/bible/repository', () => ({
  ...jest.requireActual('@/features/bible/repository'),
  searchBible: jest.fn(),
}));

// Rendering full screens is slow under coverage and a busy machine.
jest.setTimeout(30_000);

/** Results appear after the search debounce. */
const WAIT = { timeout: 5_000 };

const RESULT: BibleSearchResult = {
  verse: { id: 40_005_009, bookId: 40, chapter: 5, verse: 9, text: 'Blessed are the peacemakers.', heading: null, paragraphStart: false, poetry: false },
  snippet: 'Blessed are the «peace»makers.',
};

async function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <BibleSearch />
    </QueryClientProvider>,
  );
}

describe('BibleSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(searchBible).mockResolvedValue([RESULT]);
  });

  test('shows topic and verse results; tracks only the count', async () => {
    await renderSearch();

    await fireEvent.changeText(screen.getByLabelText('Search'), 'peace');

    const row = await screen.findByRole('button', { name: /^Matthew 5:9, WEB\. Blessed are the peacemakers\./ }, WAIT);
    expect(screen.getByRole('button', { name: 'Peace, Rest for anxious hearts' })).toBeTruthy();
    expect(searchBible).toHaveBeenCalledWith('peace', { limit: 25, offset: 0 });
    expect(track).toHaveBeenCalledWith({ name: 'bible_search_performed', resultCount: 1 });
    expect(JSON.stringify(jest.mocked(track).mock.calls)).not.toContain('peace');

    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/bible/read/40/5?verse=9');

    await fireEvent.press(screen.getByRole('button', { name: 'Peace, Rest for anxious hearts' }));
    expect(router.push).toHaveBeenLastCalledWith('/discover/peace');
  });

  test('offers "Go to" first when the query is a reference', async () => {
    jest.mocked(parseReference).mockImplementation((text) => (text === 'Romans 8:28' ? idsToRange(45_008_028) : null));
    jest.mocked(searchBible).mockResolvedValue([]);
    await renderSearch();

    await fireEvent.changeText(screen.getByLabelText('Search'), 'Romans 8:28');

    await fireEvent.press(await screen.findByRole('button', { name: 'Go to Romans 8:28' }, WAIT));
    expect(router.push).toHaveBeenCalledWith('/bible/read/45/8?verse=28');
    expect(await screen.findByText('No verses found', {}, WAIT)).toBeTruthy();
  });

  test('shows a retry when search fails', async () => {
    jest.mocked(searchBible).mockRejectedValue(new Error('fts'));
    await renderSearch();

    await fireEvent.changeText(screen.getByLabelText('Search'), 'grace');

    expect(await screen.findByRole('button', { name: 'Try again' }, WAIT)).toBeTruthy();
  });
});
