import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { BibleHome } from '@/components/bible/bible-home';
import { BooksBrowser } from '@/components/bible/books-browser';
import { db } from '@/db/client';
import { readingHistory, readingProgress } from '@/db/schema';
import { recordChapterRead, saveReadingProgress } from '@/features/bible/annotations/reading';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all(), error: undefined, updatedAt: new Date() }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));

// Rendering full screens is slow under coverage and a busy machine.
jest.setTimeout(30_000);

describe('BibleHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.delete(readingProgress).run();
    db.delete(readingHistory).run();
  });

  test('offers a first reading when nothing has been read', async () => {
    await render(<BibleHome />);

    await fireEvent.press(screen.getByRole('button', { name: 'Read John 1' }));
    expect(router.push).toHaveBeenCalledWith('/bible/read/43/1');
    expect(screen.queryByText('Recently read')).toBeNull();
  });

  test('resumes reading in one tap and lists recent chapters', async () => {
    saveReadingProgress(db, { translationId: 'WEB', bookId: 43, chapter: 3, verse: 16 });
    recordChapterRead(db, { translationId: 'WEB', bookId: 19, chapter: 23 });
    await render(<BibleHome />);

    expect(screen.getByLabelText('Chapter 3 of 21 in John')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue reading John 3' }));
    expect(router.push).toHaveBeenCalledWith('/bible/read/43/3');

    await fireEvent.press(screen.getByRole('button', { name: 'Psalm 23, Today' }));
    expect(router.push).toHaveBeenLastCalledWith('/bible/read/19/23');
  });

  test('links to books, discover and search', async () => {
    await render(<BibleHome />);

    await fireEvent.press(screen.getByRole('button', { name: 'Books, Old and New Testament' }));
    expect(router.push).toHaveBeenLastCalledWith('/bible/books');
    await fireEvent.press(screen.getByRole('button', { name: /^Discover/ }));
    expect(router.push).toHaveBeenLastCalledWith('/discover');
    await fireEvent.press(screen.getByRole('button', { name: 'Search the Bible' }));
    expect(router.push).toHaveBeenLastCalledWith('/bible/search');
  });
});

describe('BooksBrowser', () => {
  test('book → chapter with VoiceOver-friendly labels', async () => {
    const onSelectChapter = jest.fn();
    await render(<BooksBrowser onSelectChapter={onSelectChapter} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Genesis, 50 chapters' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chapter 3' }));

    expect(onSelectChapter).toHaveBeenCalledWith(1, 3);
  });

  test('switches testament and filters by name', async () => {
    const onSelectChapter = jest.fn();
    await render(<BooksBrowser onSelectChapter={onSelectChapter} />);

    await fireEvent.press(screen.getByRole('tab', { name: 'New Testament' }));
    expect(screen.getByRole('button', { name: 'Matthew, 28 chapters' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Genesis, 50 chapters' })).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Find a book'), 'jude');
    await fireEvent.press(screen.getByRole('button', { name: 'Jude, 1 chapter' }));
    expect(onSelectChapter).toHaveBeenCalledWith(65, 1);
  });

  test('opens on the testament of the current book', async () => {
    await render(<BooksBrowser onSelectChapter={jest.fn()} currentBookId={45} currentChapter={8} />);
    expect(screen.getByRole('button', { name: 'Romans, 16 chapters' })).toBeTruthy();
  });
});
