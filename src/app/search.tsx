import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';

import { BibleVerseResultRow } from '@/components/library/bible-verse-result-row';
import { SearchField } from '@/components/library/search-field';
import { SearchResultRow } from '@/components/library/search-result-row';
import { DictionaryResultRow, TopicResultRow } from '@/components/library/study-result-rows';
import { AlsoSearching, PassageCard, SuggestedSearches, TagChips } from '@/components/library/universal-search-parts';
import { Divider, EmptyState, ErrorState, FaithButton, FaithText, Screen } from '@/components/ui';
import { TOPICS_ATTRIBUTION } from '@/features/bible/study-data/repository';
import { studyRoutes } from '@/features/bible/study-data/routes';
import { passageHref } from '@/features/links/routes';
import type { SemanticVerseResult } from '@/features/search/semantic/types';
import { SUGGESTED_SEARCHES } from '@/features/search/suggestions';
import { buildSearchSections, type SearchRow, type SearchSection } from '@/features/search/universal-sections';
import { useUniversalSearch } from '@/features/search/use-universal-search';
import { GUTTER, useTheme } from '@/theme';

/** Results are paged (5 per group), so render a full first page without waiting for scroll. */
const INITIAL_ROWS = 40;

const firstParam = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));

function openVerse(verse: SemanticVerseResult) {
  router.push(passageHref(verse.startVerseId));
}

function Row({ row }: { row: SearchRow }) {
  switch (row.kind) {
    case 'personal':
      return <SearchResultRow result={row.result} onPress={() => router.push(row.result.href)} />;
    case 'verse':
      return <BibleVerseResultRow result={row.verse} onPress={openVerse} />;
    case 'topic':
      return <TopicResultRow topic={row.topic} onPress={(topic) => router.push(studyRoutes.topic(topic.id))} />;
    case 'dictionary':
      return <DictionaryResultRow entry={row.entry} onPress={(entry) => router.push(studyRoutes.dictionary(entry.id))} />;
  }
}

interface SectionFooterProps {
  section: SearchSection;
  query: string;
  onLoadMore: (section: SearchSection) => void;
}

function SectionFooter({ section, query, onLoadMore }: SectionFooterProps) {
  if (section.hasMore && section.moreType) {
    return (
      <FaithButton
        label={`Show more ${section.title.toLowerCase()}`}
        variant="secondary"
        onPress={() => onLoadMore(section)}
        style={styles.more}
      />
    );
  }
  if (section.kind === 'bible') {
    return (
      <FaithButton
        label="More Bible results"
        icon="bible"
        variant="ghost"
        onPress={() => router.push(studyRoutes.bibleSearch(query))}
        style={styles.more}
      />
    );
  }
  if (section.kind === 'topics') {
    return (
      <FaithText variant="caption" style={styles.attribution}>
        {TOPICS_ATTRIBUTION}
      </FaithText>
    );
  }
  return null;
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const { colors } = useTheme();
  const [text, setText] = useState(() => firstParam(params.q));
  const search = useUniversalSearch(text);
  const { response, bible } = search;
  const loadMore = search.loadMore;

  const sections = buildSearchSections(search.groups, search.scripture, bible);
  const hasQuery = search.query.length > 0;
  const nothingFound =
    hasQuery &&
    !!response &&
    !search.isSearching &&
    !search.bibleError &&
    sections.length === 0 &&
    !response.passage &&
    response.tags.length === 0;

  const onLoadMore = useCallback((section: SearchSection) => section.moreType && loadMore(section.moreType), [loadMore]);

  const header = (
    <View style={styles.header}>
      {response?.passage ? <PassageCard passage={response.passage} /> : null}
      <AlsoSearching words={bible.alsoSearching.length > 0 ? bible.alsoSearching : (response?.alsoSearching ?? [])} onSelect={setText} />
      <TagChips tags={response?.tags ?? []} onSelect={setText} />
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {search.isSearchingBible ? <ActivityIndicator color={colors.primaryText} accessibilityLabel="Searching the Bible" /> : null}
      {search.bibleError ? (
        <FaithText variant="secondary">The Bible couldn’t be searched just now. Your own notes are still shown.</FaithText>
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]} scroll={false} contentPadding={false}>
      <Stack.Screen options={{ title: 'Search' }} />
      <View style={styles.fieldWrap}>
        <SearchField value={text} onChangeText={setText} placeholder="Search the Bible and your library" />
      </View>
      {search.error ? (
        <ErrorState message="Search isn’t working right now. Please try again." />
      ) : !hasQuery ? (
        <View style={styles.padded}>
          <SuggestedSearches suggestions={SUGGESTED_SEARCHES} onSelect={setText} />
        </View>
      ) : nothingFound ? (
        <EmptyState
          icon="search"
          title="Nothing found"
          message={`Nothing matches “${search.query}”. Try another word, a feeling like “worry”, or a Bible reference like Romans 8:28.`}
        />
      ) : (
        <SectionList<SearchRow, SearchSection>
          sections={sections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          initialNumToRender={INITIAL_ROWS}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ItemSeparatorComponent={Divider}
          renderSectionHeader={({ section }) => (
            <FaithText variant="title" accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </FaithText>
          )}
          renderSectionFooter={({ section }) => <SectionFooter section={section} query={search.query} onLoadMore={onLoadMore} />}
          renderItem={({ item }) => <Row row={item} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 4 },
  padded: { paddingHorizontal: GUTTER },
  list: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 16, paddingTop: 12 },
  sectionTitle: { marginTop: 24, marginBottom: 4 },
  more: { marginTop: 8 },
  attribution: { marginTop: 8 },
  footer: { paddingTop: 24, gap: 12 },
});
