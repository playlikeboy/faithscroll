import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState, FaithText, Icon, TextField } from '@/components/ui';
import { filterBooks } from '@/features/bible/reader/book-search';
import type { BibleBook, Testament } from '@/features/bible/types';
import { GUTTER, MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { SegmentedControl } from './segmented-control';

const TESTAMENTS = [
  { value: 'OT', label: 'Old Testament' },
  { value: 'NT', label: 'New Testament' },
] as const;

export function bookAccessibilityLabel(book: BibleBook): string {
  return `${book.name}, ${book.chapters} ${book.chapters === 1 ? 'chapter' : 'chapters'}`;
}

function BookRow({ book, isCurrent, onPress }: { book: BibleBook; isCurrent: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bookAccessibilityLabel(book)}
      accessibilityState={{ selected: isCurrent }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && styles.pressed]}>
      <FaithText variant="bodySerif" style={styles.rowTitle} weight={isCurrent ? '600' : undefined}>
        {book.name}
      </FaithText>
      <FaithText variant="secondary">{book.chapters}</FaithText>
      <Icon name="forward" size={13} color={colors.textTertiary} />
    </Pressable>
  );
}

export interface BookListProps {
  onSelectBook: (book: BibleBook) => void;
  /** Book to open the selector on (its testament) and mark as current. */
  currentBookId?: number;
  /** Rendered above the search field (e.g. a typed-reference entry). */
  header?: ReactElement | null;
}

/** Searchable, testament-segmented list of the 66 books. */
export function BookList({ onSelectBook, currentBookId, header }: BookListProps) {
  const [query, setQuery] = useState('');
  const [testament, setTestament] = useState<Testament>(currentBookId && currentBookId >= 40 ? 'NT' : 'OT');
  const books = useMemo(() => filterBooks(query, testament), [query, testament]);

  return (
    <FlatList
      data={books}
      keyExtractor={(book) => book.code}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          <TextField
            label="Find a book"
            value={query}
            onChangeText={setQuery}
            placeholder="Genesis, Romans, Ps…"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.trim() ? null : (
            <SegmentedControl
              accessibilityLabel="Testament"
              options={TESTAMENTS}
              value={testament}
              onChange={setTestament}
            />
          )}
        </View>
      }
      ListEmptyComponent={<EmptyState icon="search" title="No books match" message="Try a shorter name, like “Rom”." />}
      renderItem={({ item }) => (
        <BookRow book={item} isCurrent={item.id === currentBookId} onPress={() => onSelectBook(item)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 14, paddingTop: 12, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: MIN_TOUCH_TARGET + 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTitle: { flex: 1 },
  pressed: { opacity: 0.6 },
});
