import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, FaithButton, FaithText, LoadingState, Section } from '@/components/ui';
import type { AppDatabase } from '@/db/types';

import { signOut } from '../account-actions';
import { NOT_CONFIGURED_MESSAGE } from '../errors';
import { useDeleteAccountFlow, type DeleteAccountOptions } from '../use-delete-account-flow';
import { useSession } from '../use-session';
import { DeleteAccountPanel } from './delete-account-panel';

export interface AccountViewProps {
  db: AppDatabase;
  isConfigured: boolean;
  onSignIn: () => void;
  /** Extra signed-in sections (e.g. cloud sync). */
  signedInExtras?: ReactNode;
  deleteOptions?: DeleteAccountOptions;
}

function SignedOut({ isConfigured, onSignIn }: { isConfigured: boolean; onSignIn: () => void }) {
  return (
    <View style={styles.stack}>
      <FaithText variant="bodySerif">
        Faithscroll works fully without an account. Everything you write stays on this device.
      </FaithText>
      <FaithText variant="secondary">
        Signing in is optional. It enables cloud backup and sync between your devices (Faithscroll Plus) and AI study
        tools such as sermon transcription and recaps.
      </FaithText>
      {isConfigured ? (
        <FaithButton label="Sign in or create an account" icon="person" onPress={onSignIn} fullWidth />
      ) : (
        <Card tone="muted">
          <FaithText variant="secondary">{NOT_CONFIGURED_MESSAGE}</FaithText>
        </Card>
      )}
    </View>
  );
}

function SignedInSummary({ email }: { email: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    setBusy(true);
    setError(null);
    const outcome = await signOut();
    if (outcome.status === 'error') setError(outcome.message);
    setBusy(false);
  }, []);

  return (
    <View style={styles.stack}>
      <View accessible accessibilityLabel={email ? `Signed in as ${email}` : 'Signed in'}>
        <FaithText variant="label">Signed in as</FaithText>
        <FaithText variant="body">{email ?? 'Apple ID'}</FaithText>
      </View>
      <FaithText variant="caption">
        Signing out keeps everything on this device. You can sign back in at any time.
      </FaithText>
      {error ? (
        <FaithText variant="secondary" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </FaithText>
      ) : null}
      <FaithButton label="Sign out" variant="secondary" onPress={() => void handleSignOut()} isLoading={busy} />
    </View>
  );
}

export function AccountView({ db, isConfigured, onSignIn, signedInExtras, deleteOptions }: AccountViewProps) {
  const { session, isLoading } = useSession();
  const deleteFlow = useDeleteAccountFlow(db, deleteOptions);

  if (deleteFlow.step === 'done') {
    return (
      <View style={styles.stack}>
        <DeleteAccountPanel flow={deleteFlow} />
        <SignedOut isConfigured={isConfigured} onSignIn={onSignIn} />
      </View>
    );
  }

  if (isLoading) return <LoadingState label="Loading your account" />;
  if (!session) return <SignedOut isConfigured={isConfigured} onSignIn={onSignIn} />;

  return (
    <View>
      <SignedInSummary email={session.user.email ?? null} />
      {signedInExtras}
      <Section title="Delete account">
        <DeleteAccountPanel flow={deleteFlow} />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
});
