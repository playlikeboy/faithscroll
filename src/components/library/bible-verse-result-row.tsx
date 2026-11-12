import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SnippetText } from '@/components/bible/search-result-row';
import { FaithText } from '@/components/ui';
import type { SemanticVerseResult } from '@/features/search/semantic/types';
import { MIN_TOUCH_TARGET } from '@/theme';

export interface BibleVerseResultRowProps {
  result: SemanticVerseResult;
  onPress: (result: SemanticVerseResult) => void;
}

/** Why this verse matched, e.g. "Related word: worried · Topic: Anxiety". */
export function explainMatch(result: SemanticVerseResult): string {
  const topic = result.topic && result.matchedVia.kind !== 'topic' ? `Topic: ${result.topic}` : null;
  return [result.matchedVia.label, topic].filter(Boolean).join(' · ');
}

/** A verse (or short passage) from concept search, with the matched words emphasised. */
export const BibleVerseResultRow = memo(function BibleVerseResultRow({ result, onPress }: BibleVerseResultRowProps) {
  const explanation = explainMatch(result);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${result.reference}. ${result.text}. ${explanation}`}
      accessibilityHint="Opens this passage in the reader"
      onPress={() => onPress(result)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.meta}>
        <FaithText variant="heading">{result.reference}</FaithText>
        <FaithText variant="caption">WEB</FaithText>
      </View>
      <SnippetText snippet={result.snippet ?? result.text} />
      <FaithText variant="caption">{explanation}</FaithText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { paddingVertical: 12, gap: 6, minHeight: MIN_TOUCH_TARGET },
  pressed: { opacity: 0.6 },
  meta: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
});
