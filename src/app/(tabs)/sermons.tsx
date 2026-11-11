import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, FaithButton } from '@/components/ui';
import { LibraryHeader, type LibraryMode } from '@/components/sermons/library-header';
import { RecoveryNotice } from '@/components/sermons/recovery-notice';
import { SeriesCard } from '@/components/sermons/series-card';
import { SermonCard } from '@/components/sermons/sermon-card';
import { useRecordingRecovery } from '@/features/recording/use-recording-recovery';
import { useSeriesList, useSermonList } from '@/features/sermons/hooks';
import { SERIES_INDEX_HREF, seriesHref, sermonHref } from '@/features/sermons/routes';
import { useDebouncedValue } from '@/features/sermons/use-debounced-value';
import { GUTTER, useTheme } from '@/theme';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 250;

function Separator() {
  return <View style={styles.separator} />;
}

export default function SermonsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [mode, setMode] = useState<LibraryMode>('sermons');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const sermons = useSermonList({ query: debouncedQuery, limit });
  const series = useSeriesList(debouncedQuery);
  const recovery = useRecordingRecovery();

  const openSermon = (id: string) => router.push(sermonHref(id));
  const openSeries = (id: string) => router.push(seriesHref(id));
  const newSermon = () => router.push('/sermons/new');

  const header = (
    <LibraryHeader
      mode={mode}
      onChangeMode={setMode}
      query={query}
      onChangeQuery={setQuery}
      onNewSermon={newSermon}
      notice={recovery.notice ? <RecoveryNotice notice={recovery.notice} onDismiss={recovery.dismiss} onOpenSermon={openSermon} /> : null}
    />
  );
  const isSearching = debouncedQuery.length > 0;
  const searchEmpty = <EmptyState icon="search" title="Nothing matches that search" message="Try a speaker, church, series or passage." />;

  if (mode === 'series') {
    return (
      <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
        <FlatList
          data={series.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SeriesCard series={item} onPress={openSeries} />}
          ListHeaderComponent={header}
          ItemSeparatorComponent={Separator}
          ListEmptyComponent={
            series.error ? (
              <ErrorState message="We couldn't load your series. Your sermons are safe on this device." onRetry={series.refresh} />
            ) : isSearching ? (
              searchEmpty
            ) : (
              <EmptyState icon="list" title="No series yet" message="Group sermons into a series when you add or edit a sermon." />
            )
          }
          ListFooterComponent={
            <FaithButton label="Manage series" icon="list" variant="ghost" onPress={() => router.push(SERIES_INDEX_HREF)} style={styles.footer} />
          }
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={sermons.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SermonCard sermon={item} onPress={openSermon} />}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          sermons.error ? (
            <ErrorState message="We couldn't load your sermons. They're still safe on this device." onRetry={sermons.refresh} />
          ) : isSearching ? (
            searchEmpty
          ) : (
            <EmptyState
              icon="sermons"
              title="Keep the sermons that move you"
              message="Record a sermon or keep notes from one you've heard. Recordings stay on this device unless you choose to transcribe them."
              actionLabel="New sermon"
              onAction={newSermon}
            />
          )
        }
        onEndReached={() => {
          if (sermons.data.length >= limit) setLimit((current) => current + PAGE_SIZE);
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  separator: { height: 12 },
  footer: { marginTop: 16, alignSelf: 'center' },
});
