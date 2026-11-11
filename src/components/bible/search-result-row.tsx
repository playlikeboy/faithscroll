import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { rangeLabel } from '@/features/bible/reader/format';
import { parseSnippet } from '@/features/bible/reader/search-helpers';
import type { BibleSearchResult } from '@/features/bible/types';
import { singleVerseRange } from '@/features/bible/verse-id';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

/** Snippet text with «matches» emphasised (weight + highlight, not colour alone). */
export function SnippetText({ snippet }: { snippet: string }) {
  const { colors } = useTheme();
  return (
    <FaithText variant="bodySerif" color="scripture">
      {parseSnippet(snippet).map((segment, index) =>
        segment.isMatch ? (
          <Text key={index} style={[styles.match, { backgroundColor: colors.highlight.gold }]}>
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </FaithText>
  );
}

export interface SearchResultRowProps {
  result: BibleSearchResult;
  translationLabel: string;
  onPress: (result: BibleSearchResult) => void;
}

export const SearchResultRow = memo(function SearchResultRow({ result, translationLabel, onPress }: SearchResultRowProps) {
  const { colors } = useTheme();
  const { verse } = result;
  const reference = rangeLabel(singleVerseRange(verse));
  const plain = parseSnippet(result.snippet)
    .map((segment) => segment.text)
    .join('');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${reference}, ${translationLabel}. ${plain}`}
      accessibilityHint="Opens this verse in the reader"
      onPress={() => onPress(result)}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && styles.pressed]}>
      <View style={styles.meta}>
        <FaithText variant="heading">{reference}</FaithText>
        <FaithText variant="caption">{translationLabel}</FaithText>
      </View>
      <SnippetText snippet={result.snippet} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { paddingVertical: 14, gap: 6, minHeight: MIN_TOUCH_TARGET, borderBottomWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.6 },
  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  match: { fontWeight: '700' },
});
