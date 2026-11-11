import { Stack } from 'expo-router';

import { SettingsScreen } from '@/components/settings/settings-screen';

export default function SettingsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <SettingsScreen />
    </>
  );
}
