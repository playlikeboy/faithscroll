/** Presentational pieces of the universal search screen (src/app/search.tsx). */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, Chip, Divider, FaithButton, FaithText } from '@/components/ui';
import type { PassageResult, TagResult } from '@/features/search/types';

import { SearchResultRow } from './search-result-row';

export function PassageCard({ passage }: { passage: PassageResult }) {
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

export function TagChips({ tags, onSelect }: { tags: TagResult[]; onSelect: (name: string) => void }) {
  if (tags.length === 0) return null;
  return (
    <View style={styles.group}>
      <FaithText variant="label">Tags</FaithText>
      <View style={styles.chipRow}>
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

/** "Also searching: worry · peace · rest" — related words from the offline concept map. */
export function AlsoSearching({ words, onSelect }: { words: readonly string[]; onSelect: (word: string) => void }) {
  if (words.length === 0) return null;
  return (
    <View style={styles.group} accessibilityLabel={`Also searching related words: ${words.join(', ')}`}>
      <FaithText variant="secondary">Also searching related words</FaithText>
      <View style={styles.chipRow}>
        {words.map((word) => (
          <Chip key={word} label={word} accessibilityHint={`Searches for ${word} instead`} onPress={() => onSelect(word)} />
        ))}
      </View>
    </View>
  );
}

export function SuggestedSearches({ suggestions, onSelect }: { suggestions: readonly string[]; onSelect: (query: string) => void }) {
  return (
    <View style={styles.intro}>
      <FaithText variant="secondary">
        Search the Bible by topic or feeling, look up a word in the Bible dictionary, or search your journal, prayers,
        sermons and notes. Type a reference like Romans 8:28 to see everything connected to it. Your search stays on this
        device.
      </FaithText>
      <FaithText variant="label" accessibilityRole="header">
        Try
      </FaithText>
      <View style={styles.chipRow}>
        {suggestions.map((suggestion) => (
          <Chip key={suggestion} icon="search" label={suggestion} accessibilityHint="Searches for this" onPress={() => onSelect(suggestion)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  passage: { gap: 10 },
  group: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  intro: { gap: 12, paddingTop: 16 },
});
