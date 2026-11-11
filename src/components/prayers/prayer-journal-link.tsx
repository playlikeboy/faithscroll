import { StyleSheet, View } from 'react-native';

import { Card, FaithText, Icon } from '@/components/ui';
import type { PrayerStatus } from '@/features/prayers/types';
import { useTheme } from '@/theme';

export interface PrayerJournalLinkProps {
  counts: Record<PrayerStatus, number> | undefined;
  onPress: () => void;
}

/** Gentle summary of prayers being held; never a score or a to-do count. */
export function prayerSummaryText(counts: Record<PrayerStatus, number> | undefined): string {
  if (!counts) return 'Keep your prayers close';
  const holding = counts.praying + counts.ongoing;
  if (holding === 0 && counts.answered === 0) return 'Write a prayer and keep it close';
  const parts = [
    holding > 0 ? `${holding} ${holding === 1 ? 'prayer' : 'prayers'} you're holding` : null,
    counts.answered > 0 ? `${counts.answered} answered` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Entry point from the Journal tab into the prayer journal. */
export function PrayerJournalLink({ counts, onPress }: PrayerJournalLinkProps) {
  const { colors } = useTheme();
  const summary = prayerSummaryText(counts);
  return (
    <Card tone="muted" onPress={onPress} accessibilityLabel={`Prayer journal, ${summary}`} accessibilityHint="Opens your prayers">
      <View style={styles.row}>
        <Icon name="prayer" size={22} color={colors.primaryText} />
        <View style={styles.text}>
          <FaithText variant="heading">Prayer journal</FaithText>
          <FaithText variant="secondary">{summary}</FaithText>
        </View>
        <Icon name="forward" size={14} color={colors.textTertiary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
});
