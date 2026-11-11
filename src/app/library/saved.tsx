import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { VerseEntryRow } from '@/components/library/verse-entry-row';
import { Divider, EmptyState, ErrorState, FaithText, IconButton, LoadingState, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { removeSavedVerse } from '@/features/bible/annotations/saved-verses';
import { useSavedVerses } from '@/features/library/use-library';
import { describeVerseRange } from '@/features/links/reference-text';
import { passageHref } from '@/features/links/routes';
import { logger } from '@/lib/logger';
import { GUTTER } from '@/theme';

export default function SavedVersesScreen() {
  const { data, error } = useSavedVerses();
  const [message, setMessage] = useState<string | null>(null);

  const remove = (id: string) => {
    setMessage(null);
    try {
      removeSavedVerse(db, id);
    } catch (removeError) {
      logger.error('Removing a saved verse failed', removeError);
      setMessage('We couldn’t remove that verse. Please try again.');
    }
  };

  return (
    <Screen edges={[]} scroll={false} contentPadding={false}>
      <Stack.Screen options={{ title: 'Saved verses' }} />
      {error ? (
        <ErrorState message="We couldn’t load your saved verses. Please try again later." />
      ) : !data ? (
        <LoadingState label="Loading saved verses" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={
            message ? (
              <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </FaithText>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState icon="bookmark" title="No saved verses yet" message="Tap a verse while reading and choose Bookmark to keep it here." />
          }
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => {
            const reference = describeVerseRange(item.startVerseId, item.endVerseId);
            return (
              <VerseEntryRow
                reference={reference}
                startVerseId={item.startVerseId}
                endVerseId={item.endVerseId}
                onPress={() => router.push(passageHref(item.startVerseId))}
                trailing={<IconButton icon="trash" accessibilityLabel={`Remove ${reference} from saved verses`} onPress={() => remove(item.id)} />}
              />
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  message: { paddingTop: 12 },
});
