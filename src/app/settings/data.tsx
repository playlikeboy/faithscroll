import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { SampleContentSection } from '@/components/settings/sample-content-section';
import { FaithButton, FaithText, ListRow, Screen, Section } from '@/components/ui';
import { db } from '@/db/client';
import { confirmDeleteAllLocalData } from '@/features/export/confirm-delete';
import { PRIVACY_PROMISES } from '@/features/export/legal-content';
import { useDeleteLocalData, useExportData, type ActionStatus } from '@/features/export/use-data-actions';
import { useSampleContent } from '@/features/seed/use-sample-content';
import { setAnalyticsEnabled, useAnalyticsEnabled } from '@/services/monitoring/analytics';
import { useAnalyticsConsentHydrated } from '@/services/monitoring/analytics-consent';
import { useTheme } from '@/theme';

function StatusText({ status }: { status: ActionStatus }) {
  if (status.kind !== 'done' && status.kind !== 'error') return null;
  return (
    <FaithText
      variant="secondary"
      color={status.kind === 'error' ? 'danger' : 'textSecondary'}
      accessibilityLiveRegion="polite"
      accessibilityRole={status.kind === 'error' ? 'alert' : 'text'}>
      {status.message}
    </FaithText>
  );
}

export default function YourDataScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { status: exportStatus, exportData } = useExportData(db);
  const { status: deleteStatus, deleteAll } = useDeleteLocalData(db);
  const samples = useSampleContent(db);
  const analyticsEnabled = useAnalyticsEnabled();
  const consentLoaded = useAnalyticsConsentHydrated();
  const busy = exportStatus.kind === 'working' || deleteStatus.kind === 'working';

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Your data' }} />

      <Section title="Your privacy">
        {PRIVACY_PROMISES.map((block) => (
          <View key={block.title} style={styles.block} accessible>
            <FaithText variant="heading">{block.title}</FaithText>
            <FaithText variant="secondary">{block.body}</FaithText>
          </View>
        ))}
      </Section>

      <Section title="Export my data">
        <FaithText variant="secondary">
          Save a copy of everything you’ve written and saved — journal, prayers, notes, highlights, sermons, transcripts
          and recaps — as a JSON file. Audio recordings stay on this device and aren’t included.
        </FaithText>
        <FaithButton
          label="Export my data"
          icon="export"
          variant="secondary"
          onPress={() => void exportData()}
          isLoading={exportStatus.kind === 'working'}
          isDisabled={busy}
        />
        <StatusText status={exportStatus} />
      </Section>

      <Section title="Usage statistics">
        <ListRow
          title="Share anonymous usage statistics"
          subtitle="Counts like “opened a chapter”. Never your words, prayers, recordings or searches."
          trailing={
            <Switch
              accessibilityLabel="Share anonymous usage statistics"
              accessibilityRole="switch"
              value={analyticsEnabled}
              disabled={!consentLoaded}
              onValueChange={setAnalyticsEnabled}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          }
        />
      </Section>

      <SampleContentSection
        hasSamples={samples.hasSamples}
        status={samples.status}
        isDisabled={busy}
        onRemove={() => void samples.removeSamples()}
      />

      <Section title="Delete data">
        <FaithText variant="secondary">
          Removes everything stored on this device and signs you out here. Data synced to your account isn’t affected —
          to remove it everywhere, delete your account.
        </FaithText>
        <FaithButton
          label="Delete all data on this device"
          icon="trash"
          variant="destructive"
          onPress={() => confirmDeleteAllLocalData(() => void deleteAll())}
          isLoading={deleteStatus.kind === 'working'}
          isDisabled={busy}
        />
        <StatusText status={deleteStatus} />
        <ListRow icon="person" title="Delete account" subtitle="Settings → Account" onPress={() => router.push('/settings/account')} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
});
