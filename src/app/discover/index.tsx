import { Stack } from 'expo-router';

import { DiscoverTopicsScreen } from '@/components/discover/discover-topics-screen';

export default function DiscoverRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Discover' }} />
      <DiscoverTopicsScreen />
    </>
  );
}
