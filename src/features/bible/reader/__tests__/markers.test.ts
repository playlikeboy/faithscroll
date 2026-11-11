import { chapterBounds, deriveChapterMarkers, sharedHighlightColor } from '@/features/bible/reader/markers';

describe('chapter markers', () => {
  test('chapter bounds cover every verse', () => {
    expect(chapterBounds(19, 119)).toEqual({ start: 19_119_000, end: 19_119_999 });
  });

  test('marks the first verse of notes and bookmarks inside the chapter', () => {
    const { start } = chapterBounds(45, 8);

    const markers = deriveChapterMarkers(
      start,
      [{ verseId: 45_008_028, color: 'gold' }],
      [{ startVerseId: 45_008_028, endVerseId: 45_008_030 }],
      [{ startVerseId: 45_007_020, endVerseId: 45_008_002 }],
    );

    expect(markers.highlights.get(45_008_028)).toBe('gold');
    expect([...markers.noteVerseIds]).toEqual([45_008_028]);
    expect([...markers.bookmarkVerseIds]).toEqual([45_008_001]);
  });

  test('shared colour only when every verse matches', () => {
    const map = new Map([
      [1, 'gold' as const],
      [2, 'gold' as const],
      [3, 'sky' as const],
    ]);
    expect(sharedHighlightColor([1, 2], map)).toBe('gold');
    expect(sharedHighlightColor([1, 3], map)).toBeNull();
    expect(sharedHighlightColor([4], map)).toBeNull();
    expect(sharedHighlightColor([], map)).toBeNull();
  });
});
