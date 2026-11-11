import { useCallback, type ReactElement } from 'react';
import { SectionList, StyleSheet, View, type SectionListRenderItemInfo } from 'react-native';

import { FaithText } from '@/components/ui';
import type { JournalSection, JournalTimelineItem } from '@/features/journal/timeline';
import { GUTTER } from '@/theme';

import { JournalEntryCard } from './journal-entry-card';

export interface JournalTimelineProps {
  sections: JournalSection[];
  onOpenEntry: (id: string) => void;
  onEndReached?: () => void;
  header: ReactElement;
  empty: ReactElement;
}

function keyExtractor(item: JournalTimelineItem): string {
  return item.entry.id;
}

/** Private notebook timeline: entries grouped under day headings. */
export function JournalTimeline({ sections, onOpenEntry, onEndReached, header, empty }: JournalTimelineProps) {
  const renderItem = useCallback(
    ({ item }: SectionListRenderItemInfo<JournalTimelineItem, JournalSection>) => (
      <JournalEntryCard item={item} onPress={onOpenEntry} />
    ),
    [onOpenEntry],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <FaithText variant="label" accessibilityRole="header">
            {section.title}
          </FaithText>
        </View>
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      stickySectionHeadersEnabled={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  sectionHeader: { paddingTop: 24, paddingBottom: 10 },
  separator: { height: 12 },
});
