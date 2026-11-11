import { createTestDb } from '@/db/testing/create-test-db';
import { saveReadingProgress } from '@/features/bible/annotations/reading';
import { resolveInitialPosition } from '@/features/bible/reader/initial-position';
import { resolveVersePress } from '@/features/bible/reader/selection';

describe('resolveInitialPosition', () => {
  test('a requested verse wins and flashes', () => {
    const db = createTestDb();
    expect(resolveInitialPosition(db, 'WEB', 43, 3, 16)).toEqual({ verse: 16, flash: true });
  });

  test('restores the saved verse when reopening the same chapter', () => {
    const db = createTestDb();
    saveReadingProgress(db, { translationId: 'WEB', bookId: 43, chapter: 3, verse: 21 });

    expect(resolveInitialPosition(db, 'WEB', 43, 3)).toEqual({ verse: 21, flash: false });
    expect(resolveInitialPosition(db, 'WEB', 43, 4)).toEqual({ verse: null, flash: false });
  });

  test('starts at the top without progress or at verse 1', () => {
    const db = createTestDb();
    expect(resolveInitialPosition(db, 'WEB', 1, 1)).toEqual({ verse: null, flash: false });
    saveReadingProgress(db, { translationId: 'WEB', bookId: 1, chapter: 1, verse: 1 });
    expect(resolveInitialPosition(db, 'WEB', 1, 1)).toEqual({ verse: null, flash: false });
  });
});

describe('resolveVersePress', () => {
  test('single verse without an anchor, ordered range with one', () => {
    expect(resolveVersePress(null, 5)).toEqual({ start: 5, end: 5 });
    expect(resolveVersePress(9, 5)).toEqual({ start: 5, end: 9 });
    expect(resolveVersePress(5, 9)).toEqual({ start: 5, end: 9 });
  });
});
