import { Stack, useLocalSearchParams } from 'expo-router';

import { RecapScreen } from '@/components/ai/recap/recap-screen';
import { EmptyState, Screen } from '@/components/ui';
import { useSermon } from '@/features/sermons/hooks';

export default function SermonRecapRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sermonId = typeof id === 'string' ? id : '';
  const sermon = useSermon(sermonId);

  if (!sermonId || (!sermon.data && !sermon.error)) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: 'Recap' }} />
        <EmptyState icon="sermons" title="Sermon not found" message="It may have been deleted." />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Recap' }} />
      <RecapScreen sermonId={sermonId} />
    </>
  );
}
