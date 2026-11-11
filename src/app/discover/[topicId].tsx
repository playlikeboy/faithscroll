import { Stack, useLocalSearchParams } from 'expo-router';

import { DiscoverSessionScreen } from '@/components/discover/discover-session-screen';
import { findTopic } from '@/features/discover/session';

export default function DiscoverTopicRoute() {
  const { topicId } = useLocalSearchParams<{ topicId?: string | string[] }>();
  const id = typeof topicId === 'string' ? topicId : undefined;
  const title = findTopic(id)?.title ?? 'Discover';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <DiscoverSessionScreen topicId={id} />
    </>
  );
}
