import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { BasicStudy } from '@/components/bible/basic-study';
import { db } from '@/db/client';
import { highlights, verseNotes } from '@/db/schema';
import { setHighlight } from '@/features/bible/annotations/highlights';
import { createVerseNote } from '@/features/bible/annotations/verse-notes';
import { getChapter, getCrossReferences, getVerses } from '@/features/bible/repository';
import type { Verse } from '@/features/bible/types';
import { idsToRange } from '@/features/bible/verse-id';
import { track } from '@/services/monitoring/analytics';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all(), error: undefined, updatedAt: new Date() }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));
jest.mock('@/features/bible/repository', () => ({
  ...jest.requireActual('@/features/bible/repository'),
  getVerses: jest.fn(),
  getChapter: jest.fn(),
  getCrossReferences: jest.fn(),
}));

const ROMANS_8: Verse[] = Array.from({ length: 39 }, (_, i) => ({
  id: 45_008_001 + i,
  bookId: 45,
  chapter: 8,
  verse: i + 1,
  text: i + 1 === 28 ? 'We know that all things work together for good.' : `Romans eight verse ${i + 1}.`,
  heading: null,
  paragraphStart: false,
  poetry: false,
}));

async function renderStudy() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <BasicStudy startVerseId={45_008_028} endVerseId={45_008_028} range={idsToRange(45_008_028)} />
    </QueryClientProvider>,
  );
}

describe('BasicStudy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.delete(highlights).run();
    db.delete(verseNotes).run();
    jest.mocked(getVerses).mockResolvedValue([ROMANS_8[27]]);
    jest.mocked(getChapter).mockResolvedValue(ROMANS_8);
    jest.mocked(getCrossReferences).mockResolvedValue([idsToRange(1_050_020)]);
  });

  test('shows Scripture, context, cross references and says it is not AI', async () => {
    await renderStudy();

    expect(await screen.findByText(/all things work together for good/)).toBeTruthy();
    expect(screen.getByText(/Nothing on this page is AI-generated/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: /^Before · Romans 8:25–27/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^After · Romans 8:29–31/ })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Genesis 50:20' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith({ name: 'study_opened', mode: 'basic' });
  });

  test('context and cross references open the reader', async () => {
    await renderStudy();

    await fireEvent.press(await screen.findByRole('button', { name: /^Before · / }));
    expect(router.push).toHaveBeenLastCalledWith('/bible/read/45/8?verse=25');

    await fireEvent.press(await screen.findByRole('button', { name: 'Genesis 50:20' }));
    expect(router.push).toHaveBeenLastCalledWith('/bible/read/1/50?verse=20');
  });

  test("lists the user's notes and highlights", async () => {
    setHighlight(db, 45_008_028, 'rose');
    const noteId = createVerseNote(db, { startVerseId: 45_008_028, endVerseId: 45_008_028, content: 'Held by grace\nmore' });
    await renderStudy();

    expect(screen.getByText('Verse 28 highlighted rose')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Held by grace, Romans 8:28' }));
    expect(router.push).toHaveBeenLastCalledWith(`/bible/note/${noteId}`);
  });

  test('links to AI ask and deep study, and to a reflection', async () => {
    await renderStudy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ask about this passage' }));
    expect(router.push).toHaveBeenLastCalledWith('/study/ask?start=45008028&end=45008028');
    await fireEvent.press(screen.getByRole('button', { name: 'Deep Study' }));
    expect(router.push).toHaveBeenLastCalledWith('/study/deep?start=45008028&end=45008028');
    await fireEvent.press(screen.getByRole('button', { name: 'Start a reflection' }));
    expect(router.push).toHaveBeenLastCalledWith('/journal/new?type=bible_study&start=45008028&end=45008028');
  });

  test('sections collapse', async () => {
    await renderStudy();

    await fireEvent.press(screen.getByRole('button', { name: 'Reflect' }));

    expect(screen.queryByRole('button', { name: 'Start a reflection' })).toBeNull();
  });
});
