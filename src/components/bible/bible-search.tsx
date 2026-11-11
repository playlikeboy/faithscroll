import { router, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { EmptyState, ErrorState, FaithButton, FaithText, ListRow, TextField } from '@/components/ui';
import { DISCOVER_TOPICS } from '@/features/bible/curated';
import { SEARCH_DEBOUNCE_MS, useBibleSearch, useDebouncedValue } from '@/features/bible/hooks/use-bible-search';
import { rangeLabel } from '@/features/bible/reader/format';
import { bibleRoutes } from '@/features/bible/reader/routes';
import { buildSearchSuggestions, MIN_SEARCH_LENGTH } from '@/features/bible/reader/search-helpers';
import { DEFAULT_TRANSLATION } from '@/features/bible/repository';
import type { BibleSearchResult } from '@/features/bible/types';
import { GUTTER, useTheme } from '@/theme';

import { bookAccessibilityLabel } from './book-list';
import { SearchResultRow } from './search-result-row';

function Suggestions({ query }: { query: string }) {
  const { reference, books, topics } = useMemo(() => buildSearchSuggestions(query, DISCOVER_TOPICS), [query]);
  if (!reference && books.length === 0 && topics.length === 0) return null;
  return (
    <View style={styles.suggestions}>
      {reference ? (
        <FaithButton
          label={`Go to ${rangeLabel(reference)}`}
          icon="bible"
          onPress={() =>
            router.push(bibleRoutes.reader(reference.start.bookId, reference.start.chapter, reference.start.verse))
          }
        />
      ) : null}
      {books.length > 0 ? (
        <View>
          <FaithText variant="label">Books</FaithText>
          {books.map((book) => (
            <ListRow
              key={book.code}
              icon="bible"
              title={book.name}
              subtitle={bookAccessibilityLabel(book).replace(`${book.name}, `, '')}
              onPress={() => router.push(bibleRoutes.reader(book.id, 1))}
            />
          ))}
        </View>
      ) : null}
      {topics.length > 0 ? (
        <View>
          <FaithText variant="label">Topics</FaithText>
          {topics.map((topic) => (
            <ListRow
              key={topic.id}
              icon="heart"
              title={topic.title}
              subtitle={topic.description}
              onPress={() => router.push(bibleRoutes.discoverTopic(topic.id))}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Search by reference, book, topic, word or phrase. */
export function BibleSearch() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const search = useBibleSearch(debounced);
  const translationLabel = DEFAULT_TRANSLATION.abbreviation;

  const openResult = useCallback(({ verse }: BibleSearchResult) => {
    router.push(bibleRoutes.reader(verse.bookId, verse.chapter, verse.verse));
  }, []);

  const renderItem: ListRenderItem<BibleSearchResult> = useCallback(
    ({ item }) => <SearchResultRow result={item} translationLabel={translationLabel} onPress={openResult} />,
    [openResult, translationLabel],
  );

  const listEmpty = (() => {
    if (!search.isEnabled) {
      return debounced.trim().length > 0 && debounced.trim().length < MIN_SEARCH_LENGTH ? null : (
        <EmptyState
          icon="search"
          title="Search the Bible"
          message="Try a word or phrase (“peace”, “love your enemies”), a reference (“Romans 8:28”) or a book."
        />
      );
    }
    if (search.isLoading) return <ActivityIndicator style={styles.spinner} color={colors.primaryText} accessibilityLabel="Searching" />;
    if (search.isError) {
      return <ErrorState message="Search didn’t work this time. Please try again." onRetry={() => void search.refetch()} />;
    }
    return <EmptyState icon="search" title="No verses found" message="Try fewer words or a different spelling." />;
  })();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Search' }} />
      <FlatList
        data={search.isEnabled ? search.results : []}
        keyExtractor={(item) => String(item.verse.id)}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              label="Search"
              value={query}
              onChangeText={setQuery}
              placeholder="Word, phrase, reference or topic"
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <Suggestions query={debounced} />
            {search.isEnabled && search.results.length > 0 ? (
              <FaithText variant="title" accessibilityRole="header" style={styles.versesTitle}>
                Verses
              </FaithText>
            ) : null}
          </View>
        }
        ListEmptyComponent={listEmpty ?? undefined}
        ListFooterComponent={
          search.isFetchingNextPage ? (
            <ActivityIndicator style={styles.spinner} color={colors.primaryText} accessibilityLabel="Loading more results" />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { paddingTop: 12, gap: 16 },
  suggestions: { gap: 16 },
  spinner: { paddingVertical: 24 },
  versesTitle: { marginTop: 8 },
});
