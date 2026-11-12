import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { SearchResultRow } from '@/components/bible/search-result-row';
import { BibleVerseResultRow } from '@/components/library/bible-verse-result-row';
import { TopicResultRow } from '@/components/library/study-result-rows';
import { AlsoSearching } from '@/components/library/universal-search-parts';
import { Divider, EmptyState, ErrorState, FaithButton, FaithText, TextField } from '@/components/ui';
import { SEARCH_DEBOUNCE_MS, useBibleSearch, useDebouncedValue } from '@/features/bible/hooks/use-bible-search';
import { formatReference, parseReference } from '@/features/bible/reference';
import { DEFAULT_TRANSLATION } from '@/features/bible/repository';
import { TOPICS_ATTRIBUTION } from '@/features/bible/study-data/repository';
import { studyRoutes } from '@/features/bible/study-data/routes';
import type { BibleSearchResult } from '@/features/bible/types';
import { toVerseId } from '@/features/bible/verse-id';
import { passageHref } from '@/features/links/routes';
import type { SemanticVerseResult } from '@/features/search/semantic/types';
import { useConceptBibleSearch } from '@/features/search/use-concept-bible-search';
import { GUTTER, useTheme } from '@/theme';

const TOPIC_LIMIT = 5;

const firstParam = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));

const openVerse = (verse: SemanticVerseResult) => router.push(passageHref(verse.startVerseId));
const openLiteral = ({ verse }: BibleSearchResult) => router.push(passageHref(verse.id));

function ConceptResults({ query, onSelectWord }: { query: string; onSelectWord: (word: string) => void }) {
  const concept = useConceptBibleSearch(query);
  const { colors } = useTheme();
  if (concept.isPending && concept.fetchStatus !== 'idle') {
    return <ActivityIndicator color={colors.primaryText} accessibilityLabel="Searching related topics" />;
  }
  if (concept.isError) return <ErrorState message="Related topics couldn’t be searched. Please try again." onRetry={() => void concept.refetch()} />;
  const data = concept.data;
  if (!data) return null;
  const topics = data.topics.slice(0, TOPIC_LIMIT);
  return (
    <View style={styles.block}>
      <AlsoSearching words={data.expansion.alsoSearching} onSelect={onSelectWord} />
      {topics.length > 0 ? (
        <View>
          <FaithText variant="title" accessibilityRole="header">
            Topics
          </FaithText>
          {topics.map((topic) => (
            <TopicResultRow key={topic.id} topic={topic} onPress={(selected) => router.push(studyRoutes.topic(selected.id))} />
          ))}
          <FaithText variant="caption">{TOPICS_ATTRIBUTION}</FaithText>
        </View>
      ) : null}
      {data.results.length > 0 ? (
        <View>
          <FaithText variant="title" accessibilityRole="header">
            Best matches
          </FaithText>
          {data.results.map((result, index) => (
            <View key={`${result.startVerseId}-${result.endVerseId}`}>
              {index > 0 ? <Divider /> : null}
              <BibleVerseResultRow result={result} onPress={openVerse} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Bible search: related topics and concept matches first, then every verse containing the words. */
export default function BibleSearchScreen() {
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const { colors } = useTheme();
  const [query, setQuery] = useState(() => firstParam(params.q));
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const literal = useBibleSearch(debounced);
  const reference = useMemo(() => parseReference(debounced), [debounced]);

  const renderItem: ListRenderItem<BibleSearchResult> = useCallback(
    ({ item }) => <SearchResultRow result={item} translationLabel={DEFAULT_TRANSLATION.abbreviation} onPress={openLiteral} />,
    [],
  );

  const header = (
    <View style={styles.header}>
      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="A feeling, topic, word, phrase or reference"
        autoFocus={!query}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {reference ? (
        <FaithButton label={`Go to ${formatReference(reference)}`} icon="bible" onPress={() => router.push(passageHref(toVerseId(reference.start)))} />
      ) : null}
      {literal.isEnabled && !reference ? <ConceptResults query={debounced} onSelectWord={setQuery} /> : null}
      {literal.isEnabled && literal.results.length > 0 ? (
        <FaithText variant="title" accessibilityRole="header" style={styles.versesTitle}>
          Every verse with these words
        </FaithText>
      ) : null}
    </View>
  );

  const empty = !literal.isEnabled ? (
    <EmptyState
      icon="search"
      title="Search the Bible"
      message="Try a feeling or topic (“worry”, “forgiveness”), a phrase (“love your enemies”) or a reference (“Romans 8:28”)."
    />
  ) : literal.isLoading ? (
    <ActivityIndicator style={styles.spinner} color={colors.primaryText} accessibilityLabel="Searching" />
  ) : literal.isError ? (
    <ErrorState message="Search didn’t work this time. Please try again." onRetry={() => void literal.refetch()} />
  ) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Search' }} />
      <FlatList
        data={literal.isEnabled ? literal.results : []}
        keyExtractor={(item) => String(item.verse.id)}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (literal.hasNextPage && !literal.isFetchingNextPage) void literal.fetchNextPage();
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ?? undefined}
        ListFooterComponent={
          literal.isFetchingNextPage ? (
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
  block: { gap: 20 },
  versesTitle: { marginTop: 8 },
  spinner: { paddingVertical: 24 },
});
