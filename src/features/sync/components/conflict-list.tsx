import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, FaithButton, FaithText } from '@/components/ui';
import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';

import { applyOtherVersion, entityLabel, keepLocalVersion, listOpenConflicts, previewOf, type ConflictRecord } from '../conflicts';
import { useSyncStore } from '../store';

function formatDate(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function ConflictCard({ conflict, onKeep, onUseOther }: { conflict: ConflictRecord; onKeep: () => void; onUseOther: () => void }) {
  const label = entityLabel(conflict.entityType);
  return (
    <Card>
      <View style={styles.card}>
        <FaithText variant="heading">
          {label} · {formatDate(conflict.createdAt)}
        </FaithText>
        <View style={styles.version} accessible accessibilityLabel={`This device: ${previewOf(conflict.local)}`}>
          <FaithText variant="label">This device (kept)</FaithText>
          <FaithText variant="secondary">{previewOf(conflict.local)}</FaithText>
        </View>
        <View style={styles.version} accessible accessibilityLabel={`Other device: ${previewOf(conflict.remote)}`}>
          <FaithText variant="label">Other device</FaithText>
          <FaithText variant="secondary">{previewOf(conflict.remote)}</FaithText>
        </View>
        <View style={styles.actions}>
          <FaithButton
            label="Keep this device's"
            variant="secondary"
            onPress={onKeep}
            accessibilityHint={`Dismisses the other device's version of this ${label.toLowerCase()}`}
          />
          <FaithButton
            label="Use other version"
            variant="ghost"
            onPress={onUseOther}
            accessibilityHint={`Replaces this device's ${label.toLowerCase()} with the other device's version`}
          />
        </View>
      </View>
    </Card>
  );
}

export function ConflictList({ db }: { db: AppDatabase }) {
  const revision = useSyncStore((s) => s.revision);
  const bumpRevision = useSyncStore((s) => s.bumpRevision);
  const [error, setError] = useState<string | null>(null);
  const conflicts = useMemo(() => {
    void revision;
    return listOpenConflicts(db);
  }, [db, revision]);

  const act = useCallback(
    (action: () => void) => {
      try {
        action();
        setError(null);
      } catch (cause) {
        logger.error('Resolving a sync conflict failed', cause);
        setError("That didn't work. Both versions are still saved; please try again.");
      }
      bumpRevision();
    },
    [bumpRevision],
  );

  if (conflicts.length === 0) return null;
  return (
    <View style={styles.list}>
      {error ? (
        <FaithText variant="secondary" color="danger" accessibilityRole="alert">
          {error}
        </FaithText>
      ) : null}
      {conflicts.map((conflict) => (
        <ConflictCard
          key={conflict.id}
          conflict={conflict}
          onKeep={() => act(() => keepLocalVersion(db, conflict.id))}
          onUseOther={() => act(() => void applyOtherVersion(db, conflict))}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { gap: 10 },
  version: { gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
