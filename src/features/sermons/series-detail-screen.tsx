/** Series page (container): details, Bible books discussed, sermon timeline, edit and delete. */
import { Stack, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { SeriesForm } from '@/components/sermons/series-form';
import { sermonCountLabel } from '@/components/sermons/series-card';
import { SeriesTimeline } from '@/components/sermons/series-timeline';
import { Chip, EmptyState, FaithButton, FaithText, IconButton, Section } from '@/components/ui';
import { db } from '@/db/client';
import { getBook } from '@/features/bible/books';
import { logger } from '@/lib/logger';
import { GUTTER, useTheme } from '@/theme';

import { useSeries, useSeriesBookIds, useSermonList } from './hooks';
import { sermonHref } from './routes';
import { seriesToFormValues, type SeriesFormOutput } from './series-form-schema';
import { deleteSeries, updateSeries } from './series-repository';

const MAX_SERIES_SERMONS = 200;

export function SeriesDetailScreen({ seriesId }: { seriesId: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const series = useSeries(seriesId);
  const sermons = useSermonList({ seriesId, order: 'oldest', limit: MAX_SERIES_SERMONS });
  const bookIds = useSeriesBookIds(seriesId);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!series.data) {
    return <EmptyState icon="list" title="This series isn't available" message="It may have been deleted." />;
  }
  const data = series.data;
  const books = bookIds.data.map((id) => getBook(id)?.name).filter((name): name is string => !!name);
  const meta = [data.speaker, data.church, sermonCountLabel(sermons.data.length)].filter(Boolean).join(' · ');

  const save = (values: SeriesFormOutput) => {
    try {
      updateSeries(db, seriesId, values);
      setErrorMessage(null);
      setIsEditing(false);
    } catch (error) {
      logger.error('Could not update series', error);
      setErrorMessage('We couldn’t save the series. Please try again.');
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this series?', 'Its sermons are kept — they just won’t belong to a series any more.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete series',
        style: 'destructive',
        onPress: () => {
          try {
            deleteSeries(db, seriesId);
            router.back();
          } catch (error) {
            logger.error('Could not delete series', error);
            setErrorMessage('We couldn’t delete the series. Please try again.');
          }
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => <IconButton icon="edit" accessibilityLabel="Edit series" onPress={() => setIsEditing(true)} />,
        }}
      />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled">
        {isEditing ? (
          <SeriesForm defaultValues={seriesToFormValues(data)} submitLabel="Save series" onSubmit={save} onCancel={() => setIsEditing(false)} />
        ) : (
          <View style={styles.header}>
            <FaithText variant="label">Series</FaithText>
            <FaithText variant="display" accessibilityRole="header">
              {data.title}
            </FaithText>
            <FaithText variant="secondary">{meta}</FaithText>
            {data.description ? <FaithText variant="bodySerif">{data.description}</FaithText> : null}
          </View>
        )}
        {errorMessage ? (
          <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
            {errorMessage}
          </FaithText>
        ) : null}

        {books.length > 0 ? (
          <Section title="Bible books discussed">
            <View style={styles.books}>
              {books.map((name) => (
                <Chip key={name} label={name} icon="bible" />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Timeline">
          <SeriesTimeline sermons={sermons.data} onOpenSermon={(id) => router.push(sermonHref(id))} />
          <FaithButton
            label="Add a sermon to this series"
            icon="add"
            variant="secondary"
            onPress={() => router.push(`/sermons/new?seriesId=${encodeURIComponent(seriesId)}` as Href)}
          />
        </Section>

        <View style={styles.danger}>
          <FaithButton label="Delete series" icon="trash" variant="destructive" onPress={confirmDelete} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 56, gap: 4 },
  header: { gap: 8 },
  books: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  danger: { marginTop: 36 },
});
