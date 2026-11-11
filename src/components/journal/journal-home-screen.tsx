import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrayerJournalLink } from '@/components/prayers/prayer-journal-link';
import { ErrorState, FaithText, IconButton, LoadingState, Screen } from '@/components/ui';
import { useJournalTimeline } from '@/features/journal/use-journal-timeline';
import { usePrayerSummary } from '@/features/prayers/use-prayer-summary';

import { EntryTypeFilter } from './entry-type-filter';
import { JournalEmptyState } from './journal-empty-state';
import { JournalTimeline } from './journal-timeline';
import { SearchField } from './search-field';

/** Journal tab: a private notebook timeline with filters, search and the prayer journal entry point. */
export function JournalHomeScreen() {
  const router = useRouter();
  const timeline = useJournalTimeline();
  const prayerCounts = usePrayerSummary();

  const openEntry = useCallback((id: string) => router.push(`/journal/${encodeURIComponent(id)}` as Href), [router]);
  const newEntry = () => router.push('/journal/new' as Href);
  const newEntryWithPrompt = (prompt: string) => router.push({ pathname: '/journal/new', params: { prompt } } as Href);
  const clearFilters = () => {
    timeline.setType(null);
    timeline.setSearch('');
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <FaithText variant="display" accessibilityRole="header" style={styles.title}>
          Journal
        </FaithText>
        <IconButton icon="add" accessibilityLabel="New journal entry" onPress={newEntry} filled />
      </View>
      <PrayerJournalLink counts={prayerCounts} onPress={() => router.push('/prayers' as Href)} />
      <SearchField value={timeline.search} onChangeText={timeline.setSearch} placeholder="Search your journal" />
      <EntryTypeFilter value={timeline.type} onChange={timeline.setType} allLabel="All" />
    </View>
  );

  const empty = timeline.error ? (
    <ErrorState
      title="We couldn't open your journal"
      message="Your entries are safe on this device. Please try again."
      onRetry={timeline.reload}
    />
  ) : timeline.isLoading ? (
    <LoadingState label="Loading your journal" />
  ) : (
    <JournalEmptyState
      isFiltered={timeline.isFiltered}
      onNewEntry={newEntry}
      onPrompt={newEntryWithPrompt}
      onClearFilters={clearFilters}
    />
  );

  return (
    <Screen scroll={false} contentPadding={false}>
      <JournalTimeline
        sections={timeline.sections}
        onOpenEntry={openEntry}
        onEndReached={timeline.loadMore}
        header={header}
        empty={empty}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 14, paddingTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  title: { flex: 1 },
});
