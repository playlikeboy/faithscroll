import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ChapterBlockView } from '@/components/bible/chapter-block';
import { ChapterReader } from '@/components/bible/chapter-reader';
import { db } from '@/db/client';
import { highlights, readingHistory, readingProgress } from '@/db/schema';
import { setHighlight } from '@/features/bible/annotations/highlights';
import { useScreenReaderEnabled } from '@/features/bible/hooks/use-accessibility-settings';
import { deriveChapterMarkers } from '@/features/bible/reader/markers';
import { buildChapterBlocks } from '@/features/bible/reader/paragraphs';
import { getChapter } from '@/features/bible/repository';
import type { Verse } from '@/features/bible/types';
import { track } from '@/services/monitoring/analytics';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all(), error: undefined, updatedAt: new Date() }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));
jest.mock('@/features/bible/hooks/use-accessibility-settings', () => ({
  useScreenReaderEnabled: jest.fn(() => false),
  useReduceMotion: jest.fn(() => false),
}));
jest.mock('@/features/bible/repository', () => ({
  ...jest.requireActual('@/features/bible/repository'),
  getChapter: jest.fn(),
}));

// Rendering full screens is slow under coverage and a busy machine.
jest.setTimeout(30_000);

function verse(n: number, text: string, extra: Partial<Verse> = {}): Verse {
  return { id: 43_003_000 + n, bookId: 43, chapter: 3, verse: n, text, heading: null, paragraphStart: false, poetry: false, ...extra };
}

const JOHN_3: Verse[] = [
  verse(16, 'For God so loved the world.', { heading: 'God’s love for the world', paragraphStart: true }),
  verse(17, 'For God didn’t send his Son to judge the world.'),
];

async function renderReader(props: { verse?: number } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={client}>
      <ChapterReader bookId={43} chapter={3} {...props} />
    </QueryClientProvider>,
  );
}

/** Deepest Text whose content matches — the tappable verse span. */
function verseSpan(pattern: RegExp) {
  return screen.getAllByText(pattern).at(-1)!;
}

describe('ChapterReader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getChapter).mockResolvedValue(JOHN_3);
    jest.mocked(useScreenReaderEnabled).mockReturnValue(false);
    for (const table of [highlights, readingHistory, readingProgress]) db.delete(table).run();
  });

  test('renders the chapter, headings and translation, and records the visit', async () => {
    await renderReader();

    expect(await screen.findByText('Chapter 3')).toBeTruthy();
    expect(screen.getByText('God’s love for the world')).toBeTruthy();
    expect(screen.getByText('World English Bible (WEB)')).toBeTruthy();
    expect(screen.getAllByText(/For God so loved the world/).length).toBeGreaterThan(0);
    expect(track).toHaveBeenCalledWith({ name: 'chapter_opened', bookId: 43, chapter: 3 });
    expect(db.select().from(readingHistory).all()).toHaveLength(1);
    expect(db.select().from(readingProgress).get()).toEqual(expect.objectContaining({ bookId: 43, chapter: 3 }));
  });

  test('tapping a verse opens the verse action sheet', async () => {
    await renderReader();
    await screen.findByText('Chapter 3');

    await fireEvent.press(verseSpan(/For God so loved the world/));

    expect(router.push).toHaveBeenCalledWith('/bible/verse-actions?start=43003016&end=43003016');
  });

  test('long-press then tap selects a multi-verse range', async () => {
    await renderReader();
    await screen.findByText('Chapter 3');

    await fireEvent(verseSpan(/For God so loved the world/), 'longPress');
    expect(screen.getByText(/Selecting from John 3:16/)).toBeTruthy();
    await fireEvent.press(verseSpan(/didn’t send his Son/));

    expect(router.push).toHaveBeenCalledWith('/bible/verse-actions?start=43003016&end=43003017');
    expect(screen.queryByText(/Selecting from/)).toBeNull();
  });

  test('next chapter replaces the reader', async () => {
    await renderReader();
    await screen.findByText('Chapter 3');

    await fireEvent.press(screen.getByRole('button', { name: 'John 4' }));

    expect(router.replace).toHaveBeenCalledWith('/bible/read/43/4');
  });

  test('with a screen reader every verse is its own labelled control', async () => {
    jest.mocked(useScreenReaderEnabled).mockReturnValue(true);
    setHighlight(db, 43_003_016, 'gold');
    await renderReader();

    const row = await screen.findByRole('button', { name: 'Verse 16. For God so loved the world. Highlighted gold' });
    await fireEvent.press(row);

    expect(router.push).toHaveBeenCalledWith('/bible/verse-actions?start=43003016&end=43003016');
    expect(screen.getByRole('button', { name: /^Verse 17\./ })).toBeTruthy();
  });

  test('shows a friendly state when the chapter has no text yet', async () => {
    jest.mocked(getChapter).mockResolvedValue([]);
    await renderReader();

    expect(await screen.findByText("John 3 isn't available yet")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose another chapter' }));
    expect(router.push).toHaveBeenCalledWith('/bible/books?replace=1');
  });

  test('shows an error with retry when the chapter fails to load', async () => {
    jest.mocked(getChapter).mockRejectedValue(new Error('disk'));
    await renderReader();

    expect(await screen.findByText("This chapter didn't open")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('ChapterBlockView', () => {
  test('renders poetry lines and verse numbers', async () => {
    const block = buildChapterBlocks([
      { ...verse(1, 'Yahweh is my shepherd;'), poetry: true },
      { ...verse(2, 'He makes me lie down in green pastures.'), poetry: true },
    ])[0];
    const onPress = jest.fn();

    await render(
      <ChapterBlockView
        block={block}
        fontSize={21}
        markers={deriveChapterMarkers(43_003_000, [], [{ startVerseId: 43_003_002, endVerseId: 43_003_002 }], [])}
        anchorVerseId={null}
        flashVerseId={null}
        layout="flow"
        onPressVerse={onPress}
        onLongPressVerse={jest.fn()}
      />,
    );

    // Verse numbers lead each line; the note marker follows verse 2's number.
    expect(screen.getAllByText(/^1\s*Yahweh is my shepherd;\s+2✎\s*He makes me lie down/).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getAllByText(/green pastures/).at(-1)!);
    expect(onPress).toHaveBeenCalledWith(43_003_002);
  });
});
