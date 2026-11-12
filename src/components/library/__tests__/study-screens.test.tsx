/** Bible search, topic and dictionary screens against the real bundled Bible database. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';

import BibleSearchScreen from '@/app/bible/search';
import DictionaryEntryScreen from '@/app/bible/dictionary/[id]';
import TopicScreen from '@/app/bible/topic/[id]';
import { installBundledBibleForTests } from '@/features/bible/db/testing/node-executor';
import { findDictionaryEntriesByName, findTopicsByName } from '@/features/bible/study-data/repository';

jest.setTimeout(30_000);

const mockParams: { current: Record<string, string> } = { current: {} };

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));

let restore: () => void;

beforeAll(() => {
  restore = installBundledBibleForTests();
});

afterAll(() => restore());

beforeEach(() => jest.clearAllMocks());

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('Bible search screen', () => {
  it('shows related topics, best matches and literal verses for ?q=', async () => {
    mockParams.current = { q: 'worried' };
    await renderWithClient(<BibleSearchScreen />);
    expect(await screen.findByRole('header', { name: 'Best matches' }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Topics' })).toBeTruthy();
    expect(screen.getByText('Also searching related words')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Worried, \d+ passages/ }));
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/bible\/topic\/\d+$/));
  });

  it('offers to open a reference', async () => {
    mockParams.current = { q: 'Romans 8:28' };
    await renderWithClient(<BibleSearchScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Go to Romans 8:28' }, { timeout: 10_000 }));
    expect(router.push).toHaveBeenCalledWith('/bible/read/45/8?verse=28');
  });
});

describe('topic screen', () => {
  it('lists the most helpful passages and Nave subtopics', async () => {
    const [love] = await findTopicsByName(['love']);
    mockParams.current = { id: String(love.id) };
    await renderWithClient(<TopicScreen />);
    expect(await screen.findByRole('header', { name: 'Most helpful' }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Of man for God' })).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: /^1 Corinthians 13:4/ })[0]);
    expect(router.push).toHaveBeenCalledWith('/bible/read/46/13?verse=4');
  });

  it('handles an unknown topic', async () => {
    mockParams.current = { id: 'abc' };
    await renderWithClient(<TopicScreen />);
    expect(screen.getByText('Topic not found')).toBeTruthy();
  });
});

describe('dictionary screen', () => {
  it('shows the definition with linked references', async () => {
    const [grace] = await findDictionaryEntriesByName(['grace']);
    mockParams.current = { id: String(grace.id) };
    await renderWithClient(<DictionaryEntryScreen />);
    expect(await screen.findByRole('header', { name: 'Grace' }, { timeout: 10_000 })).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getAllByRole('link')[0]);
    });
    expect(router.push).toHaveBeenCalledWith('/bible/read/20/1?verse=9');
  });
});
