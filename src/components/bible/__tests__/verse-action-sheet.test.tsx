import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Share } from 'react-native';

import { VerseActionSheet } from '@/components/bible/verse-action-sheet';
import { db } from '@/db/client';
import { collectionItems, collections, highlights, outbox, savedVerses, verseNotes } from '@/db/schema';
import { getCrossReferences, getVerses } from '@/features/bible/repository';
import type { Verse } from '@/features/bible/types';
import { idsToRange } from '@/features/bible/verse-id';
import { track } from '@/services/monitoring/analytics';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all(), error: undefined, updatedAt: new Date() }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
}));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));
jest.mock('@/features/bible/repository', () => ({
  ...jest.requireActual('@/features/bible/repository'),
  getVerses: jest.fn(),
  getCrossReferences: jest.fn(),
}));

// Rendering full screens is slow under coverage and a busy machine.
jest.setTimeout(30_000);

const ROM_8_28 = 45_008_028;
const ROM_8_29 = 45_008_029;

const VERSES: Verse[] = [
  { id: ROM_8_28, bookId: 45, chapter: 8, verse: 28, text: 'We know that all things work together for good.', heading: null, paragraphStart: true, poetry: false },
  { id: ROM_8_29, bookId: 45, chapter: 8, verse: 29, text: 'For whom he foreknew, he also predestined.', heading: null, paragraphStart: false, poetry: false },
];

async function renderSheet(start = ROM_8_28, end = ROM_8_29) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const view = await render(
    <QueryClientProvider client={client}>
      <VerseActionSheet startVerseId={start} endVerseId={end} range={idsToRange(start, end)} />
    </QueryClientProvider>,
  );
  await screen.findByText(start === end ? 'Romans 8:28' : 'Romans 8:28–29');
  return view;
}

describe('VerseActionSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getVerses).mockResolvedValue(VERSES);
    jest.mocked(getCrossReferences).mockResolvedValue([idsToRange(19_023_001)]);
    for (const table of [collectionItems, collections, highlights, savedVerses, verseNotes, outbox]) db.delete(table).run();
  });

  test('shows the reference, passage text and all eight actions', async () => {
    await renderSheet();

    expect(screen.getAllByText(/all things work together for good/).length).toBeGreaterThan(0);
    for (const name of [
      'Add note',
      'Bookmark',
      'Add to collection',
      'Open study',
      'Find related verses',
      'Share verse',
      'Start a reflection',
    ]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'Highlight gold' })).toBeTruthy();
  });

  test('highlights every verse in the range and can remove it', async () => {
    const { rerender } = await renderSheet();

    await fireEvent.press(screen.getByRole('radio', { name: 'Highlight sage' }));

    expect(db.select().from(highlights).all().map((row) => [row.verseId, row.color])).toEqual([
      [ROM_8_28, 'sage'],
      [ROM_8_29, 'sage'],
    ]);
    expect(track).toHaveBeenCalledWith({ name: 'verse_highlighted' });

    await rerender(
      <QueryClientProvider client={new QueryClient()}>
        <VerseActionSheet startVerseId={ROM_8_28} endVerseId={ROM_8_29} range={idsToRange(ROM_8_28, ROM_8_29)} />
      </QueryClientProvider>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove highlight' }));
    expect(db.select().from(highlights).all().every((row) => row.deletedAt !== null)).toBe(true);
  });

  test('bookmark toggles the saved range', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Bookmark' }));

    expect(db.select().from(savedVerses).all()).toEqual([
      expect.objectContaining({ startVerseId: ROM_8_28, endVerseId: ROM_8_29, deletedAt: null }),
    ]);
    expect(track).toHaveBeenCalledWith({ name: 'verse_saved' });
  });

  test('add note creates the note first, then opens the editor', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Add note' }));

    const note = db.select().from(verseNotes).get();
    expect(note).toEqual(expect.objectContaining({ startVerseId: ROM_8_28, endVerseId: ROM_8_29, content: '' }));
    expect(router.back).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(`/bible/note/${note?.id}`);
  });

  test('navigation actions close the sheet and open the right routes', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Open study' }));
    expect(router.push).toHaveBeenLastCalledWith('/bible/study/45008028?end=45008029');

    await fireEvent.press(screen.getByRole('button', { name: 'Start a reflection' }));
    expect(router.push).toHaveBeenLastCalledWith('/journal/new?type=bible_study&start=45008028&end=45008029');

    await fireEvent.press(screen.getByRole('button', { name: 'Add to collection' }));
    expect(router.push).toHaveBeenLastCalledWith('/bible/collections-picker?start=45008028&end=45008029');
  });

  test('find related verses lists cross references that open the reader', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Find related verses' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Psalm 23:1' }));

    expect(getCrossReferences).toHaveBeenCalledWith(ROM_8_28, 8);
    expect(router.push).toHaveBeenLastCalledWith('/bible/read/19/23?verse=1');
  });

  test('share sends text, reference and translation', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderSheet(ROM_8_28, ROM_8_28);

    await fireEvent.press(screen.getByRole('button', { name: 'Share verse' }));

    expect(share).toHaveBeenCalledWith({
      message: expect.stringMatching(/all things work together for good[\s\S]*Romans 8:28 \(World English Bible\)/),
    });
  });
});
