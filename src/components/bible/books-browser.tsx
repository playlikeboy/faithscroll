import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FaithButton, FaithText } from '@/components/ui';
import { getBook } from '@/features/bible/books';
import type { BibleBook } from '@/features/bible/types';
import { GUTTER, useTheme } from '@/theme';

import { BookList } from './book-list';
import { NumberGrid } from './number-grid';

export interface BooksBrowserProps {
  onSelectChapter: (bookId: number, chapter: number) => void;
  currentBookId?: number;
  currentChapter?: number;
}

function ChapterStep({
  book,
  currentChapter,
  onBack,
  onSelect,
}: {
  book: BibleBook;
  currentChapter?: number;
  onBack: () => void;
  onSelect: (chapter: number) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.chapters} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.chapterHeader}>
        <FaithText variant="display" accessibilityRole="header">
          {book.name}
        </FaithText>
        <FaithText variant="secondary">{`${book.chapters} ${book.chapters === 1 ? 'chapter' : 'chapters'}`}</FaithText>
      </View>
      <NumberGrid
        count={book.chapters}
        noun="Chapter"
        onSelect={onSelect}
        isSelected={(chapter) => chapter === currentChapter}
      />
      <FaithButton label="All books" icon="back" variant="ghost" onPress={onBack} style={styles.back} />
    </ScrollView>
  );
}

/** Testament → book → chapter navigation (Books modal). */
export function BooksBrowser({ onSelectChapter, currentBookId, currentChapter }: BooksBrowserProps) {
  const { colors } = useTheme();
  const [book, setBook] = useState<BibleBook | null>(null);

  const handleSelectBook = (selected: BibleBook) => {
    if (selected.chapters === 1) onSelectChapter(selected.id, 1);
    else setBook(selected);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: book ? book.name : 'Books' }} />
      {book ? (
        <ChapterStep
          book={book}
          currentChapter={book.id === currentBookId ? currentChapter : undefined}
          onBack={() => setBook(null)}
          onSelect={(chapter) => onSelectChapter(book.id, chapter)}
        />
      ) : (
        // Keyed so the testament tab follows the reading position once it has loaded.
        <BookList
          key={currentBookId ?? 'none'}
          onSelectBook={handleSelectBook}
          currentBookId={getBook(currentBookId ?? 0)?.id}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chapters: { paddingHorizontal: GUTTER, paddingBottom: 48, gap: 20 },
  chapterHeader: { paddingTop: 16, gap: 4 },
  back: { alignSelf: 'flex-start' },
});
