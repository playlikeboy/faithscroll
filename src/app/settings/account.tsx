import { router, Stack } from 'expo-router';
import { useCallback } from 'react';

import { Screen } from '@/components/ui';
import { db } from '@/db/client';
import { AccountView } from '@/features/auth/components/account-view';
import type { DeleteAccountOptions } from '@/features/auth/use-delete-account-flow';
import { prepareLocalDataForNextAccount, resetSyncAfterAccountDeletion } from '@/features/sync/account-sync';
import { SyncSection } from '@/features/sync/components/sync-section';
import { isSupabaseConfigured } from '@/services/supabase/client';

const DELETE_OPTIONS: DeleteAccountOptions = {
  keepLocalData: prepareLocalDataForNextAccount,
  afterDeletion: resetSyncAfterAccountDeletion,
};

export default function AccountScreen() {
  const handleSignIn = useCallback(() => router.push('/auth/sign-in'), []);
  const handleOpenPaywall = useCallback(() => router.push({ pathname: '/paywall', params: { source: 'sync' } }), []);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Account' }} />
      <AccountView
        db={db}
        isConfigured={isSupabaseConfigured()}
        onSignIn={handleSignIn}
        signedInExtras={<SyncSection db={db} onOpenPaywall={handleOpenPaywall} />}
        deleteOptions={DELETE_OPTIONS}
      />
    </Screen>
  );
}
