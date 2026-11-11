import { Stack } from 'expo-router';

import { AppearanceScreen } from '@/components/settings/appearance-screen';

export default function AppearanceRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Appearance' }} />
      <AppearanceScreen />
    </>
  );
}
