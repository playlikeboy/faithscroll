import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { CollectionNameForm } from '@/components/library/collection-name-form';
import { Card, Divider, EmptyState, ErrorState, FaithButton, FaithText, IconButton, ListRow, LoadingState, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { deleteCollection, removeFromCollection, updateCollection } from '@/features/bible/annotations/collections';
import type { CollectionDetail, CollectionEntry } from '@/features/library/collection-views';
import { useCollectionDetail } from '@/features/library/use-library';
import { LINK_TYPE_ICONS, LINK_TYPE_LABELS } from '@/features/links/resolve';
import { logger } from '@/lib/logger';

function EntryRow({ collectionId, entry, onError }: { collectionId: string; entry: CollectionEntry; onError: (message: string) => void }) {
  const remove = () => {
    try {
      removeFromCollection(db, collectionId, entry.entityType, entry.entityId);
    } catch (error) {
      logger.error('Removing a collection item failed', error);
      onError('We couldn’t remove that item. Please try again.');
    }
  };
  const subtitle = [LINK_TYPE_LABELS[entry.entityType], entry.subtitle].filter(Boolean).join(' · ');
  return (
    <View style={styles.entry}>
      <View style={styles.entryBody}>
        <ListRow icon={LINK_TYPE_ICONS[entry.entityType]} title={entry.title} subtitle={subtitle} onPress={() => router.push(entry.href)} />
      </View>
      <IconButton icon="close" accessibilityLabel={`Remove ${entry.title} from this collection`} onPress={remove} />
    </View>
  );
}

function CollectionBody({ detail }: { detail: CollectionDetail }) {
  const [isRenaming, setRenaming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const confirmDelete = () => {
    Alert.alert('Delete this collection?', 'The items in it stay in your library; only the collection is removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteCollection(db, detail.id);
            router.back();
          } catch (error) {
            logger.error('Deleting a collection failed', error);
            setMessage('We couldn’t delete this collection. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.body}>
      {isRenaming ? (
        <CollectionNameForm
          initialValue={detail.title}
          submitLabel="Save name"
          onSubmit={(title) => {
            updateCollection(db, detail.id, { title, description: detail.description });
            setRenaming(false);
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <>
          <FaithText variant="display" accessibilityRole="header">
            {detail.title}
          </FaithText>
          {detail.description ? <FaithText variant="secondary">{detail.description}</FaithText> : null}
          <View style={styles.actions}>
            <FaithButton label="Rename" icon="edit" variant="secondary" onPress={() => setRenaming(true)} />
            <FaithButton label="Delete" icon="trash" variant="destructive" onPress={confirmDelete} />
          </View>
        </>
      )}
      {message ? (
        <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {message}
        </FaithText>
      ) : null}
      {detail.entries.length === 0 ? (
        <EmptyState
          icon="collection"
          title="Nothing here yet"
          message="Add verses, sermons, prayers and journal entries from their Add to collection action."
        />
      ) : (
        <Card>
          {detail.entries.map((entry, index) => (
            <View key={entry.itemId}>
              {index > 0 ? <Divider /> : null}
              <EntryRow collectionId={detail.id} entry={entry} onError={setMessage} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useCollectionDetail(typeof id === 'string' ? id : '');

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: data?.title ?? 'Collection' }} />
      {error ? (
        <ErrorState message="We couldn’t load this collection. Please try again later." />
      ) : data === undefined ? (
        <LoadingState label="Loading collection" />
      ) : data === null ? (
        <EmptyState icon="collection" title="Collection not found" message="It may have been deleted." />
      ) : (
        <CollectionBody detail={data} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingTop: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  entryBody: { flex: 1 },
});
