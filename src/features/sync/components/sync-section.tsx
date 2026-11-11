import { useCallback, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Card, FaithButton, FaithText, Section } from '@/components/ui';
import type { AppDatabase } from '@/db/types';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { syncNow } from '../init';
import { useSyncStore } from '../store';
import { formatLastSynced, syncProblemMessage, useSyncStatus } from '../use-sync-status';
import { ConflictList } from './conflict-list';

export interface SyncSectionProps {
  db: AppDatabase;
  onOpenPaywall: () => void;
  /** Injectable for tests. */
  onSyncNow?: () => Promise<void>;
}

export function SyncSection({ db, onOpenPaywall, onSyncNow = syncNow }: SyncSectionProps) {
  const { colors } = useTheme();
  const status = useSyncStatus(db);
  const setCloudSyncEnabled = useSyncStore((s) => s.setCloudSyncEnabled);
  const [showConflicts, setShowConflicts] = useState(false);
  const active = status.cloudSyncEnabled && status.entitlementActive;
  const syncing = status.phase === 'syncing';

  const handleSyncNow = useCallback(() => {
    void onSyncNow();
  }, [onSyncNow]);

  return (
    <Section title="Backup & sync">
      <View style={styles.row}>
        <View style={styles.rowText}>
          <FaithText variant="body">Back up and sync across devices</FaithText>
          <FaithText variant="caption">
            {status.entitlementActive
              ? 'Your notes, journal, prayers and sermons are copied privately to your account.'
              : 'Part of Faithscroll Plus. Everything always stays on this device either way.'}
          </FaithText>
        </View>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel="Back up and sync across devices"
          accessibilityState={{ checked: active, disabled: !status.entitlementActive }}
          value={active}
          disabled={!status.entitlementActive}
          onValueChange={setCloudSyncEnabled}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      {!status.entitlementActive ? (
        <FaithButton label="Learn about Faithscroll Plus" variant="secondary" icon="cloud" onPress={onOpenPaywall} />
      ) : null}

      {active ? (
        <View style={styles.status}>
          <FaithText variant="secondary" accessibilityLiveRegion="polite">
            {syncing ? 'Syncing…' : `Last synced: ${formatLastSynced(status.lastSyncedAt)}`}
          </FaithText>
          {status.pendingChanges > 0 && !syncing ? (
            <FaithText variant="caption">
              {status.pendingChanges} change{status.pendingChanges === 1 ? '' : 's'} waiting to upload
            </FaithText>
          ) : null}
          {status.problem ? (
            <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
              {syncProblemMessage(status.problem)}
            </FaithText>
          ) : null}
          <FaithButton label="Sync now" variant="secondary" onPress={handleSyncNow} isLoading={syncing} />
        </View>
      ) : null}

      {status.conflictsCount > 0 ? (
        <Card tone="muted">
          <View style={styles.status}>
            <FaithText variant="heading">
              {status.conflictsCount} item{status.conflictsCount === 1 ? ' was' : 's were'} edited on two devices
            </FaithText>
            <FaithText variant="secondary">
              Nothing was lost: this device&apos;s version was kept and the other version was saved. Review them when
              you like.
            </FaithText>
            <FaithButton
              label={showConflicts ? 'Hide versions' : 'Review versions'}
              variant="ghost"
              onPress={() => setShowConflicts((value) => !value)}
            />
          </View>
        </Card>
      ) : null}
      {showConflicts ? <ConflictList db={db} /> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET },
  rowText: { flex: 1, gap: 2 },
  status: { gap: 8 },
});
