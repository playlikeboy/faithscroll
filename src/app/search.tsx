import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { SearchField } from '@/components/library/search-field';
import { SearchResultRow } from '@/components/library/search-result-row';
import { Card, Chip, Divider, EmptyState, ErrorState, FaithButton, FaithText, Screen } from '@/components/ui';
import { isSearchable } from '@/features/search/query';
import type { PassageResult, SearchResult, SearchResultType, TagResult } from '@/features/search/types';
import { useUniversalSearch } from '@/features/search/use-universal-search';
import { GUTTER } from '@/theme';

/** Results are paged (5 per group), so render a full first page without waiting for scroll. */
const INITIAL_ROWS = 40;

interface ResultSection {
  key: string;
  type: SearchResultType | null;
  title: string;
  hasMore: boolean;
  data: SearchResult[];
}

function PassageCard({ passage }: { passage: PassageResult }) {
  return (
    <Card>
      <View style={styles.passage}>
        <FaithText variant="label">Bible passage</FaithText>
        <FaithText variant="title">{passage.reference}</FaithText>
        <FaithButton label={`Read ${passage.reference}`} icon="bible" onPress={() => router.push(passage.href)} />
        <FaithText variant="secondary">
          {passage.related.length === 0
            ? 'Nothing in your library mentions this passage yet.'
            : `In your library (${passage.related.length})`}
        </FaithText>
        {passage.related.map((result, index) => (
          <View key={`${result.type}:${result.id}`}>
            {index > 0 ? <Divider /> : null}
            <SearchResultRow result={result} onPress={() => router.push(result.href)} />
          </View>
        ))}
      </View>
    </Card>
  );
}

function TagChips({ tags, onSelect }: { tags: TagResult[]; onSelect: (name: string) => void }) {
  if (tags.length === 0) return null;
  return (
    <View style={styles.tags}>
      <FaithText variant="label">Tags</FaithText>
      <View style={styles.tagRow}>
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            icon="tag"
            label={`${tag.name} · ${tag.itemCount}`}
            accessibilityHint={`Searches for items tagged ${tag.name}`}
            onPress={() => onSelect(tag.name)}
          />
        ))}
      </View>
    </View>
  );
}

function Intro() {
  return (
    <FaithText variant="secondary" style={styles.intro}>
      Search your journal, prayers, sermons, Bible notes, actions and collections — or type a reference like Romans 8:28 to
      see everything connected to it. Your search stays on this device.
    </FaithText>
  );
}

export default function SearchScreen() {
  const [text, setText] = useState('');
  const search = useUniversalSearch(text);
  const { response } = search;

  const sections: ResultSection[] = [
    ...search.groups.map((group) => ({ key: group.type, type: group.type, title: group.label, hasMore: group.hasMore, data: group.results })),
    ...(search.scripture.length > 0
      ? [{ key: 'scripture', type: null, title: 'Saved verses & highlights', hasMore: false, data: search.scripture }]
      : []),
  ];
  const hasQuery = search.query.length > 0;
  const nothingFound =
    hasQuery && !!response && !search.isSearching && sections.length === 0 && !response.passage && response.tags.length === 0;

  const header = (
    <View style={styles.header}>
      {response?.passage ? <PassageCard passage={response.passage} /> : null}
      <TagChips tags={response?.tags ?? []} onSelect={setText} />
    </View>
  );

  const footer =
    hasQuery && isSearchable(search.query) ? (
      <View style={styles.footer}>
        <FaithButton
          label="Search the Bible text instead"
          icon="bible"
          variant="ghost"
          onPress={() => router.push(`/bible/search?q=${encodeURIComponent(search.query)}` as Href)}
        />
      </View>
    ) : undefined;

  return (
    <Screen edges={[]} scroll={false} contentPadding={false}>
      <Stack.Screen options={{ title: 'Search' }} />
      <View style={styles.fieldWrap}>
        <SearchField value={text} onChangeText={setText} />
      </View>
      {search.error ? (
        <ErrorState message="Search isn’t working right now. Please try again." />
      ) : !hasQuery ? (
        <View style={styles.padded}>
          <Intro />
        </View>
      ) : nothingFound ? (
        <EmptyState
          icon="search"
          title="Nothing found"
          message={`Nothing in your library matches “${search.query}”. Try another word, or a Bible reference like Romans 8:28.`}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.type}:${item.id}`}
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
          renderSectionFooter={({ section }) =>
            section.hasMore && section.type ? (
              <FaithButton
                label={`Show more ${section.title.toLowerCase()}`}
                variant="secondary"
                onPress={() => section.type && search.loadMore(section.type)}
                style={styles.more}
              />
            ) : null
          }
          renderItem={({ item }) => <SearchResultRow result={item} onPress={() => router.push(item.href)} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 4 },
  padded: { paddingHorizontal: GUTTER },
  intro: { paddingTop: 16 },
  list: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 16, paddingTop: 12 },
  passage: { gap: 10 },
  tags: { gap: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { marginTop: 24, marginBottom: 4 },
  more: { marginTop: 8 },
  footer: { paddingTop: 24 },
});
