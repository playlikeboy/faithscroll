import type { ReactNode } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, FaithText, LoadingState } from '@/components/ui';
import { findReferences } from '@/features/bible/reference';
import { useDictionaryEntry } from '@/features/bible/study-data/hooks';
import { DICTIONARY_ATTRIBUTION } from '@/features/bible/study-data/repository';
import { rangeToIds } from '@/features/bible/verse-id';
import { passageHref } from '@/features/links/routes';
import { GUTTER, useTheme } from '@/theme';

/** A paragraph with every Scripture reference it mentions ("Rom. 11:6") as a link to the reader. */
function LinkedParagraph({ text }: { text: string }) {
  const { colors } = useTheme();
  const found = findReferences(text);
  const parts: ReactNode[] = [];
  let cursor = 0;
  found.forEach((reference, index) => {
    if (reference.index > cursor) parts.push(text.slice(cursor, reference.index));
    const start = rangeToIds(reference.range).startVerseId;
    parts.push(
      <Text
        key={`ref-${index}`}
        accessibilityRole="link"
        accessibilityHint="Opens this passage in the reader"
        onPress={() => router.push(passageHref(start))}
        style={[styles.link, { color: colors.primaryText }]}>
        {reference.text}
      </Text>,
    );
    cursor = reference.index + reference.length;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <FaithText variant="bodySerif">{parts}</FaithText>;
}

/** One entry of Easton's Bible Dictionary (1897, public domain). */
export default function DictionaryEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Number.parseInt(String(id ?? ''), 10);
  const { data: entry, isPending, isError, refetch } = useDictionaryEntry(entryId);

  if (!Number.isInteger(entryId) || entryId <= 0 || (!isPending && !isError && !entry)) {
    return <EmptyState icon="search" title="Entry not found" message="This word isn’t in the bundled Bible dictionary." />;
  }
  if (isError) return <ErrorState message="This entry couldn’t be opened. Please try again." onRetry={() => void refetch()} />;
  if (isPending || !entry) return <LoadingState />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: entry.term }} />
      <View style={styles.header}>
        <FaithText variant="label">Bible dictionary</FaithText>
        <FaithText variant="display" accessibilityRole="header">
          {entry.term}
        </FaithText>
      </View>
      {entry.definition.split(/\n{2,}/).map((paragraph, index) => (
        <LinkedParagraph key={index} text={paragraph} />
      ))}
      <FaithText variant="caption" style={styles.footer}>
        {DICTIONARY_ATTRIBUTION} Language and scholarship are from 1897 and may be dated.
      </FaithText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48, paddingTop: 12, gap: 14 },
  header: { gap: 4 },
  link: { textDecorationLine: 'underline' },
  footer: { paddingTop: 16 },
});
