import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { HIGHLIGHT_COLOR_LABELS, HighlightColorFilter } from '@/components/library/highlight-color-filter';
import { VerseEntryRow } from '@/components/library/verse-entry-row';
import { Divider, EmptyState, ErrorState, FaithText, LoadingState, Screen } from '@/components/ui';
import type { HighlightColorName } from '@/features/library/annotation-lists';
import { useHighlightGroups } from '@/features/library/use-library';
import { describeVerseRange } from '@/features/links/reference-text';
import { passageHref } from '@/features/links/routes';
import { GUTTER, useTheme } from '@/theme';

function Swatch({ color }: { color: HighlightColorName }) {
  const { colors } = useTheme();
  return <View style={[styles.swatch, { backgroundColor: colors.highlight[color], borderColor: colors.border }]} />;
}

export default function HighlightsScreen() {
  const [color, setColor] = useState<HighlightColorName | null>(null);
  const { data, error } = useHighlightGroups(color);
  const sections = (data ?? []).map((group) => ({ key: String(group.bookId), title: group.bookName, data: group.items }));
  const emptyMessage = color
    ? `No ${HIGHLIGHT_COLOR_LABELS[color].toLowerCase()} highlights yet.`
    : 'Tap a verse while reading and choose a colour to highlight it.';

  return (
    <Screen edges={[]} scroll={false} contentPadding={false}>
      <Stack.Screen options={{ title: 'Highlights' }} />
      {error ? (
        <ErrorState message="We couldn’t load your highlights. Please try again later." />
      ) : !data ? (
        <LoadingState label="Loading highlights" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={<HighlightColorFilter value={color} onChange={setColor} />}
          ListEmptyComponent={<EmptyState icon="highlight" title="No highlights yet" message={emptyMessage} />}
          ItemSeparatorComponent={Divider}
          renderSectionHeader={({ section }) => (
            <FaithText variant="title" accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </FaithText>
          )}
          renderItem={({ item }) => (
            <VerseEntryRow
              reference={describeVerseRange(item.verseId)}
              startVerseId={item.verseId}
              detail={`${HIGHLIGHT_COLOR_LABELS[item.color]} highlight`}
              leading={<Swatch color={item.color} />}
              onPress={() => router.push(passageHref(item.verseId))}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  sectionTitle: { marginTop: 20, marginBottom: 4 },
  swatch: { width: 12, height: 12, borderRadius: 6, marginTop: 6, borderWidth: StyleSheet.hairlineWidth },
});
