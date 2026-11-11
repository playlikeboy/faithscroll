import { router, Stack, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CollectionNameForm } from '@/components/library/collection-name-form';
import { Card, Divider, EmptyState, ErrorState, ListRow, LoadingState, Screen, Section } from '@/components/ui';
import { db } from '@/db/client';
import { createCollection } from '@/features/bible/annotations/collections';
import { useCollectionSummaries } from '@/features/library/use-library';

function itemCountLabel(count: number): string {
  return count === 1 ? '1 item' : `${count} items`;
}

export default function CollectionsScreen() {
  const { data, error } = useCollectionSummaries();

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Collections' }} />
      <Section title="New collection">
        <CollectionNameForm submitLabel="Create collection" onSubmit={(title) => createCollection(db, { title })} />
      </Section>
      <Section title="Your collections">
        {error ? (
          <ErrorState message="We couldn’t load your collections. Please try again later." />
        ) : !data ? (
          <LoadingState label="Loading collections" />
        ) : data.length === 0 ? (
          <EmptyState
            icon="collection"
            title="No collections yet"
            message="Gather sermons, verses, prayers and journal entries around a theme."
          />
        ) : (
          <Card>
            {data.map((collection, index) => (
              <View key={collection.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  icon="collection"
                  title={collection.title}
                  subtitle={itemCountLabel(collection.itemCount)}
                  onPress={() => router.push(`/library/collections/${encodeURIComponent(collection.id)}` as Href)}
                />
              </View>
            ))}
          </Card>
        )}
      </Section>
      <View style={styles.spacer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spacer: { height: 24 },
});
