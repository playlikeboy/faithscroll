import { router, Stack } from 'expo-router';
import { useCallback } from 'react';

import { Screen } from '@/components/ui';
import { SignInView } from '@/features/auth/components/sign-in-view';
import { isSupabaseConfigured } from '@/services/supabase/client';

export default function SignInScreen() {
  const handleSignedIn = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings/account');
  }, []);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <SignInView isConfigured={isSupabaseConfigured()} onSignedIn={handleSignedIn} />
    </Screen>
  );
}
