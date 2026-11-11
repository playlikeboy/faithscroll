import { router, Stack } from 'expo-router';
import { useCallback } from 'react';

import { Screen } from '@/components/ui';
import { db } from '@/db/client';
import { AccountView } from '@/features/auth/components/account-view';
import { isSupabaseConfigured } from '@/services/supabase/client';

export default function AccountScreen() {
  const handleSignIn = useCallback(() => router.push('/auth/sign-in'), []);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Account' }} />
      <AccountView db={db} isConfigured={isSupabaseConfigured()} onSignIn={handleSignIn} />
    </Screen>
  );
}
