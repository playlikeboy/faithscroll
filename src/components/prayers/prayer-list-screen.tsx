import { Stack, useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SearchField } from '@/components/journal/search-field';
import { EmptyState, ErrorState, FaithText, IconButton, LoadingState } from '@/components/ui';
import type { PrayerSection } from '@/features/prayers/grouping';
import type { Prayer } from '@/features/prayers/types';
import { usePrayerList } from '@/features/prayers/use-prayer-list';
import { GUTTER, useTheme } from '@/theme';

import { PrayerCard } from './prayer-card';

/** Prayer journal home: prayers grouped Praying / Ongoing / Answered / Archived. */
export function PrayerListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const list = usePrayerList();

  const openPrayer = useCallback((id: string) => router.push(`/prayers/${encodeURIComponent(id)}` as Href), [router]);
  const newPrayer = () => router.push('/prayers/new' as Href);

  const header = (
    <View style={styles.header}>
      <FaithText variant="secondary">
        A private place to hold your prayers and notice how God meets you. There&apos;s no right pace.
      </FaithText>
      <SearchField value={list.search} onChangeText={list.setSearch} placeholder="Search your prayers" />
    </View>
  );

  const empty = list.error ? (
    <ErrorState title="We couldn't open your prayers" message="They're safe on this device. Please try again." onRetry={list.reload} />
  ) : list.isLoading ? (
    <LoadingState label="Loading your prayers" />
  ) : list.isFiltered ? (
    <EmptyState icon="search" title="No prayers match" message="Try another word." />
  ) : (
    <EmptyState
      icon="prayer"
      title="Keep your prayers close"
      message="Write what's on your heart. Later you can note how things change — answered, ongoing, or set aside."
      actionLabel="Write a prayer"
      onAction={newPrayer}
    />
  );

  return (
    <SafeAreaView edges={[]} style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Prayers',
          headerRight: () => <IconButton icon="add" accessibilityLabel="New prayer" onPress={newPrayer} />,
        }}
      />
      <SectionList<Prayer, PrayerSection>
        sections={list.sections}
        keyExtractor={(prayer) => prayer.id}
        renderItem={({ item }) => <PrayerCard prayer={item} references={list.references.get(item.id)} onPress={openPrayer} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <FaithText variant="title" accessibilityRole="header">
              {section.title}
            </FaithText>
            <FaithText variant="caption">{section.description}</FaithText>
          </View>
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 14, paddingTop: 8 },
  sectionHeader: { paddingTop: 28, paddingBottom: 10, gap: 2 },
  separator: { height: 12 },
});
