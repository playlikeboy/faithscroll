import { StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { getBook } from '@/features/bible/books';
import { useTheme } from '@/theme';

export interface ReadingProgressProps {
  bookId: number;
  chapter: number;
}

/** Calm "Chapter 3 of 21" bar for a position within a book (no streaks, no goals). */
export function ReadingProgress({ bookId, chapter }: ReadingProgressProps) {
  const { colors } = useTheme();
  const book = getBook(bookId);
  if (!book) return null;
  const fraction = Math.min(1, Math.max(0, chapter / book.chapters));
  const label = `Chapter ${chapter} of ${book.chapters} in ${book.name}`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: book.chapters, now: chapter }}
      style={styles.root}>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.fill, { backgroundColor: colors.accent, width: `${fraction * 100}%` }]} />
      </View>
      <FaithText variant="caption">{`Chapter ${chapter} of ${book.chapters}`}</FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
