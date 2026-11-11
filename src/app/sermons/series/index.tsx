import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { SeriesCard } from '@/components/sermons/series-card';
import { SeriesForm } from '@/components/sermons/series-form';
import { EmptyState, ErrorState, FaithButton, FaithText } from '@/components/ui';
import { db } from '@/db/client';
import { useSeriesList } from '@/features/sermons/hooks';
import { seriesHref } from '@/features/sermons/routes';
import { emptySeriesForm, type SeriesFormOutput } from '@/features/sermons/series-form-schema';
import { createSeries } from '@/features/sermons/series-repository';
import { logger } from '@/lib/logger';
import { GUTTER, useTheme } from '@/theme';

function Separator() {
  return <View style={styles.separator} />;
}

export default function SeriesIndexScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const series = useSeriesList();
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const create = (values: SeriesFormOutput) => {
    try {
      const created = createSeries(db, values);
      setIsCreating(false);
      setErrorMessage(null);
      router.push(seriesHref(created.id));
    } catch (error) {
      logger.error('Could not create series', error);
      setErrorMessage('We couldn’t create the series. Please try again.');
    }
  };

  const header = (
    <View style={styles.header}>
      <FaithText variant="secondary">Group sermons that belong together, and see the passages a series has walked through.</FaithText>
      {isCreating ? (
        <SeriesForm defaultValues={emptySeriesForm()} submitLabel="Create series" onSubmit={create} onCancel={() => setIsCreating(false)} />
      ) : (
        <FaithButton label="New series" icon="add" variant="secondary" onPress={() => setIsCreating(true)} fullWidth />
      )}
      {errorMessage ? (
        <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {errorMessage}
        </FaithText>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Series' }} />
      <FlatList
        style={{ backgroundColor: colors.background }}
        data={series.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SeriesCard series={item} onPress={(id) => router.push(seriesHref(id))} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          series.error ? (
            <ErrorState message="We couldn't load your series." onRetry={series.refresh} />
          ) : (
            <EmptyState icon="list" title="No series yet" message="Create one here, or when you add a sermon." />
          )
        }
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 16, paddingTop: 12, paddingBottom: 16 },
  separator: { height: 12 },
});
