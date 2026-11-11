import { useLocalSearchParams } from 'expo-router';

import { CollectionsPicker } from '@/components/bible/collections-picker';
import { PassageNotFound } from '@/components/bible/passage-not-found';
import { parseCollectionTarget } from '@/features/bible/reader/params';

/**
 * `?start=&end=` adds a verse range (as a saved verse);
 * `?entityType=&entityId=` adds any linkable item (journal entry, sermon, prayer…).
 */
export default function CollectionsPickerScreen() {
  const target = parseCollectionTarget(useLocalSearchParams());
  if (!target) {
    return <PassageNotFound title="Nothing to add" message="Open this from a verse or an item in your library." />;
  }
  return <CollectionsPicker target={target} />;
}
