import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import LibraryScreen from '@/app/(tabs)/library';
import ActionItemsScreen from '@/app/library/actions';
import CollectionScreen from '@/app/library/collections/[id]';
import CollectionsScreen from '@/app/library/collections/index';
import HighlightsScreen from '@/app/library/highlights';
import BibleNotesScreen from '@/app/library/notes';
import SavedVersesScreen from '@/app/library/saved';
import { db } from '@/db/client';
import { getActionItem, listActionItems } from '@/features/library/action-items';
import { listCollectionSummaries } from '@/features/library/collection-views';
import {
  seedActionItem,
  seedCollection,
  seedCollectionItem,
  seedHighlight,
  seedPrayer,
  seedSavedVerse,
  seedSermon,
  seedVerseNote,
} from '@/features/library/testing/fixtures';
import { notifyTables } from '@/features/library/testing/live-db-mocks';
import { listSavedVerses } from '@/features/library/annotation-lists';

jest.mock('expo-sqlite', () => jest.requireActual('@/features/library/testing/live-db-mocks').expoSqliteMock);
jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, DateTimePickerAndroid: { open: jest.fn() } };
});
jest.mock('@/features/bible/hooks/use-bible-text', () => ({
  useVerses: () => ({ data: [{ text: 'For God so loved the world.' }], isLoading: false, isError: false }),
}));
jest.mock('@/features/reminders/scheduler', () => ({
  cancelReminder: jest.fn(async () => undefined),
  scheduleOneTimeReminderWithResult: jest.fn(async () => ({ status: 'scheduled', id: 'n1' })),
}));

const ALL_TABLES = ['saved_verses', 'highlights', 'verse_notes', 'collections', 'collection_items', 'action_items', 'sermons'];

async function refresh() {
  await act(async () => notifyTables(...ALL_TABLES));
}

beforeEach(() => jest.clearAllMocks());

describe('Library tab', () => {
  it('shows live counts and navigates to each section', async () => {
    seedSavedVerse(db);
    seedSermon(db);
    seedSermon(db);
    await render(<LibraryScreen />);
    expect(screen.getByRole('button', { name: 'Saved verses, 1 saved' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sermons, 2 sermons' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('search', { name: 'Search your library' }));
    expect(router.push).toHaveBeenCalledWith('/search');
    await fireEvent.press(screen.getByRole('button', { name: /^Series/ }));
    expect(router.push).toHaveBeenCalledWith('/sermons/series');
    await fireEvent.press(screen.getByRole('button', { name: /^Prayers/ }));
    expect(router.push).toHaveBeenCalledWith('/prayers');
    await fireEvent.press(screen.getByRole('button', { name: /^Reading plans/ }));
    expect(router.push).toHaveBeenCalledWith('/plans');
  });
});

describe('Highlights', () => {
  it('groups by book, filters by colour and opens the reader', async () => {
    seedHighlight(db, { verseId: 43003016, color: 'gold' });
    seedHighlight(db, { verseId: 45008028, color: 'sky' });
    await render(<HighlightsScreen />);
    expect(screen.getByText('John')).toBeTruthy();
    expect(screen.getByText('Romans')).toBeTruthy();
    expect(screen.getAllByText('For God so loved the world.').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Sky highlights' }));
    expect(screen.queryByText('John')).toBeNull();
    expect(screen.getByText('Romans')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Romans 8:28/ }));
    expect(router.push).toHaveBeenCalledWith('/bible/read/45/8?verse=28');
  });
});

describe('Saved verses and notes', () => {
  it('removes a saved verse', async () => {
    const id = seedSavedVerse(db, { startVerseId: 19023001, endVerseId: 19023003 });
    await render(<SavedVersesScreen />);
    await fireEvent.press(screen.getByRole('button', { name: /Remove Psalm 23:1–3|Remove Psalms 23:1–3/ }));
    expect(listSavedVerses(db).some((row) => row.id === id)).toBe(false);
  });

  it('lists Bible notes and opens one', async () => {
    const id = seedVerseNote(db, { content: '**Seventy times seven** — keep forgiving', startVerseId: 40018022, endVerseId: 40018022 });
    await render(<BibleNotesScreen />);
    expect(screen.getByText(/Seventy times seven/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Matthew 18:22/ }));
    expect(router.push).toHaveBeenCalledWith(`/bible/note/${id}`);
  });
});

describe('Collections', () => {
  it('creates a collection', async () => {
    await render(<CollectionsScreen />);
    await fireEvent.changeText(screen.getByLabelText('Collection name'), 'Hope');
    await fireEvent.press(screen.getByRole('button', { name: 'Create collection' }));
    await refresh();
    expect(listCollectionSummaries(db).some((row) => row.title === 'Hope')).toBe(true);
    expect(screen.getByRole('button', { name: /Hope, 0 items/ })).toBeTruthy();
  });

  it('renames, removes items and deletes a collection', async () => {
    const collection = seedCollection(db, { title: 'Grace' });
    const prayer = seedPrayer(db, { title: 'For my neighbour' });
    seedCollectionItem(db, { collectionId: collection, entityType: 'prayer_entry', entityId: prayer });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: collection });
    await render(<CollectionScreen />);
    expect(screen.getByText('For my neighbour')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Remove For my neighbour from this collection' }));
    await refresh();
    expect(screen.queryByText('For my neighbour')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Rename' }));
    await fireEvent.changeText(screen.getByLabelText('Collection name'), 'Amazing grace');
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
    await refresh();
    expect(screen.getByText('Amazing grace')).toBeTruthy();

    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    const buttons = alert.mock.calls[0][2] ?? [];
    await act(async () => buttons.find((button) => button.text === 'Delete')?.onPress?.());
    expect(router.back).toHaveBeenCalled();
    expect(listCollectionSummaries(db).some((row) => row.id === collection)).toBe(false);
  });
});

describe('Action items', () => {
  it('adds a manual action, completes it and links to its source', async () => {
    const sermon = seedSermon(db, { title: 'The Power of Forgiveness' });
    seedActionItem(db, { title: 'Forgive as you were forgiven', sourceType: 'sermon', sourceId: sermon });
    await render(<ActionItemsScreen />);

    await fireEvent.press(screen.getByRole('link', { name: 'From the sermon “The Power of Forgiveness”' }));
    expect(router.push).toHaveBeenCalledWith(`/sermons/${sermon}`);

    await fireEvent.press(screen.getByRole('button', { name: 'Add action' }));
    await fireEvent.changeText(screen.getByLabelText('What will you do?'), 'Write a thank-you note');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await refresh();
    expect(screen.getByText('Write a thank-you note')).toBeTruthy();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Write a thank-you note' }));
    await refresh();
    expect(screen.queryByText('Write a thank-you note')).toBeNull();
    const done = listActionItems(db, 'completed').find((row) => row.title === 'Write a thank-you note');
    expect(done && getActionItem(db, done.id)?.completedAt).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Completed' }));
    await refresh();
    expect(screen.getByText('Write a thank-you note')).toBeTruthy();
  });
});
