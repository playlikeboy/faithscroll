import { StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { PRAYER_STATUS_LABELS, type PrayerUpdate } from '@/features/prayers/types';
import { useTheme } from '@/theme';

export interface PrayerUpdatesTimelineProps {
  updates: readonly PrayerUpdate[];
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The story of a prayer: status moves and notes, newest first. */
export function PrayerUpdatesTimeline({ updates }: PrayerUpdatesTimelineProps) {
  const { colors } = useTheme();
  if (updates.length === 0) return null;

  return (
    <View style={styles.container}>
      <FaithText variant="label" accessibilityRole="header">
        Updates
      </FaithText>
      {updates.map((update) => {
        const heading = update.statusChange ? `Moved to ${PRAYER_STATUS_LABELS[update.statusChange]}` : 'Note';
        const when = formatWhen(update.createdAt);
        return (
          <View
            key={update.id}
            style={[styles.item, { borderLeftColor: colors.accent }]}
            accessible
            accessibilityLabel={[heading, when, update.content].filter(Boolean).join('. ')}>
            <View style={styles.headingRow}>
              <FaithText variant="heading" style={styles.flex}>
                {heading}
              </FaithText>
              <FaithText variant="caption">{when}</FaithText>
            </View>
            {update.content ? <FaithText variant="bodySerif">{update.content}</FaithText> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  item: { borderLeftWidth: 2, paddingLeft: 12, gap: 4 },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  flex: { flex: 1 },
});
