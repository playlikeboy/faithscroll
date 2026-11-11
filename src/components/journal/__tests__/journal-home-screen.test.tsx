import { fireEvent, render, screen } from '@testing-library/react-native';

import { db } from '@/db/client';
import { createJournalEntry } from '@/features/journal/repository';
import { createPrayer } from '@/features/prayers/repository';
import { assignTag } from '@/features/tags/repository';

import { JournalHomeScreen } from '../journal-home-screen';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('expo-sqlite', () => ({ addDatabaseChangeListener: () => ({ remove: () => undefined }) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }) }));

// The first render pays for loading the native-module mocks and migrating the test DB.
jest.setTimeout(30_000);

beforeEach(() => mockPush.mockClear());

describe('JournalHomeScreen', () => {
  test('shows a friendly empty state with the PRD prompts', async () => {
    await render(<JournalHomeScreen />);

    expect(await screen.findByText('A quiet place to reflect')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'What am I grateful for?' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/journal/new', params: { prompt: 'What am I grateful for?' } });
  });

  test('lists entries by day, filters by type and opens an entry', async () => {
    const gratitude = createJournalEntry(db, { title: 'Morning light', content: 'Thankful', entryType: 'gratitude', entryDate: '2026-11-09' });
    createJournalEntry(db, { title: 'Hard day', content: 'Struggling', entryType: 'personal', entryDate: '2026-11-08' });
    assignTag(db, 'journal_entry', gratitude.id, 'Joy');

    await render(<JournalHomeScreen />);

    expect(await screen.findByText('Morning light')).toBeTruthy();
    expect(screen.getByText('Hard day')).toBeTruthy();
    expect(screen.getByText('#Joy')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Gratitude' }));
    expect(await screen.findByText('Morning light')).toBeTruthy();
    expect(screen.queryByText('Hard day')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /Morning light/ }));
    expect(mockPush).toHaveBeenCalledWith(`/journal/${gratitude.id}`);
  });

  test('navigates to new entry and the prayer journal', async () => {
    createPrayer(db, { title: 'For my brother' });
    await render(<JournalHomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'New journal entry' }));
    expect(mockPush).toHaveBeenLastCalledWith('/journal/new');

    const prayers = await screen.findByRole('button', { name: /Prayer journal, 1 prayer you're holding/ });
    await fireEvent.press(prayers);
    expect(mockPush).toHaveBeenLastCalledWith('/prayers');
  });
});
