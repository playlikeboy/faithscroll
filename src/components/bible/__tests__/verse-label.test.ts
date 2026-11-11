import { verseAccessibilityLabel } from '@/components/bible/verse-label';

describe('verseAccessibilityLabel', () => {
  test('reads number and text', () => {
    expect(verseAccessibilityLabel(1, 'In the beginning')).toBe('Verse 1. In the beginning');
  });

  test('describes annotations in words, without doubled punctuation', () => {
    expect(
      verseAccessibilityLabel(28, 'We know that all things work together for good. ', {
        highlight: 'sage',
        hasNote: true,
        isBookmarked: true,
        isSelected: true,
      }),
    ).toBe(
      'Verse 28. We know that all things work together for good. Highlighted sage. Has a note. Bookmarked. Selected as range start',
    );
    expect(verseAccessibilityLabel(2, 'and', { hasNote: true })).toBe('Verse 2. and. Has a note');
  });
});
