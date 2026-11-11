import { StyleSheet, Switch, View } from 'react-native';

import { Card, FaithButton, FaithText } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import type { DeleteAccountFlow } from '../use-delete-account-flow';

const DELETED_ITEMS = [
  'Your Faithscroll account and sign-in',
  'Everything backed up to the cloud: journal entries, prayers, sermon notes, highlights and collections',
  'Cloud copies of sermon audio, transcripts and recaps',
  'AI study history and usage records',
];

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <FaithText variant="secondary" accessibilityElementsHidden importantForAccessibility="no">
        •
      </FaithText>
      <FaithText variant="secondary" style={styles.bulletText}>
        {text}
      </FaithText>
    </View>
  );
}

export function DeleteAccountPanel({ flow }: { flow: DeleteAccountFlow }) {
  const { colors } = useTheme();

  if (flow.step === 'done') {
    return (
      <Card tone="muted">
        <FaithText variant="body" accessibilityLiveRegion="polite">
          {flow.result}
        </FaithText>
      </Card>
    );
  }

  if (flow.step === 'idle') {
    return (
      <FaithButton
        label="Delete account…"
        variant="destructive"
        icon="trash"
        onPress={flow.start}
        accessibilityHint="Explains what will be deleted before asking you to confirm"
      />
    );
  }

  const busy = flow.step === 'deleting';
  return (
    <Card>
      <View style={styles.panel}>
        <FaithText variant="heading" accessibilityRole="header">
          Deleting your account permanently removes:
        </FaithText>
        <View style={styles.list}>
          {DELETED_ITEMS.map((item) => (
            <Bullet key={item} text={item} />
          ))}
        </View>
        <FaithText variant="secondary">
          A Faithscroll Plus subscription is billed by Apple or Google and is not cancelled by deleting your account.
          Manage it in your store subscription settings.
        </FaithText>

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <FaithText variant="body">Also erase data on this device</FaithText>
            <FaithText variant="caption">
              {flow.eraseLocal
                ? 'Your Bible notes, journal, prayers, sermons and recordings on this device will be erased too.'
                : 'Off: everything on this device stays and keeps working without an account.'}
            </FaithText>
          </View>
          <Switch
            accessibilityRole="switch"
            accessibilityLabel="Also erase data on this device"
            accessibilityState={{ checked: flow.eraseLocal, disabled: busy }}
            value={flow.eraseLocal}
            onValueChange={flow.setEraseLocal}
            disabled={busy}
            trackColor={{ true: colors.danger, false: colors.border }}
          />
        </View>

        {flow.error ? (
          <FaithText variant="secondary" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
            {flow.error}
          </FaithText>
        ) : null}

        <View style={styles.actions}>
          <FaithButton label="Keep my account" variant="secondary" onPress={flow.cancel} isDisabled={busy} />
          <FaithButton label="Delete account" variant="destructive" onPress={flow.confirm} isLoading={busy} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 14 },
  list: { gap: 6 },
  bullet: { flexDirection: 'row', gap: 8 },
  bulletText: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET },
  switchText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
});
