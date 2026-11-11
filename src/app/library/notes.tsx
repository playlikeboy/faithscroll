import { router, Stack, type Href } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';

import { VerseEntryRow } from '@/components/library/verse-entry-row';
import { Divider, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { excerpt } from '@/features/journal/plain-text';
import { useVerseNotes } from '@/features/library/use-library';
import { describeVerseRange } from '@/features/links/reference-text';
import { GUTTER } from '@/theme';

const NOTE_EXCERPT_LENGTH = 160;

export default function BibleNotesScreen() {
  const { data, error } = useVerseNotes();

  return (
    <Screen edges={[]} scroll={false} contentPadding={false}>
      <Stack.Screen options={{ title: 'Bible notes' }} />
      {error ? (
        <ErrorState message="We couldn’t load your Bible notes. Please try again later." />
      ) : !data ? (
        <LoadingState label="Loading Bible notes" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={
            <EmptyState icon="note" title="No Bible notes yet" message="Tap a verse while reading and choose Add note to start one." />
          }
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <VerseEntryRow
              reference={describeVerseRange(item.startVerseId, item.endVerseId)}
              startVerseId={item.startVerseId}
              endVerseId={item.endVerseId}
              detail={excerpt(item.content, NOTE_EXCERPT_LENGTH) || 'Empty note'}
              showText={false}
              accessibilityHint="Opens the note"
              onPress={() => router.push(`/bible/note/${encodeURIComponent(item.id)}` as Href)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: GUTTER, paddingBottom: 48 },
});
