import { StyleSheet, View } from 'react-native';

import { Card, FaithText } from '@/components/ui';
import type { LimitRow } from '@/features/subscriptions/plan-content';
import { useTheme } from '@/theme';

export interface LimitsTableProps {
  rows: readonly LimitRow[];
  notes: readonly string[];
}

/** AI and storage allowances per month, explained before any purchase. */
export function LimitsTable({ rows, notes }: LimitsTableProps) {
  const { colors } = useTheme();
  return (
    <Card tone="muted" style={styles.card}>
      <View style={styles.headerRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <FaithText variant="label" style={styles.featureCol}>
          Each month
        </FaithText>
        <FaithText variant="label" style={styles.valueCol} align="right">
          Free
        </FaithText>
        <FaithText variant="label" style={styles.valueCol} align="right">
          Plus
        </FaithText>
      </View>
      {rows.map((row) => (
        <View
          key={row.feature}
          style={[styles.row, { borderTopColor: colors.border }]}
          accessible
          accessibilityLabel={`${row.feature}: ${row.free} free, ${row.plus} with Plus, each month`}>
          <FaithText variant="secondary" color="text" style={styles.featureCol}>
            {row.feature}
          </FaithText>
          <FaithText variant="secondary" style={styles.valueCol} align="right">
            {row.free}
          </FaithText>
          <FaithText variant="secondary" color="text" weight="600" style={styles.valueCol} align="right">
            {row.plus}
          </FaithText>
        </View>
      ))}
      <View style={styles.notes}>
        {notes.map((note) => (
          <FaithText key={note} variant="caption">
            {note}
          </FaithText>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  headerRow: { flexDirection: 'row', paddingBottom: 6, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  featureCol: { flex: 2 },
  valueCol: { flex: 1 },
  notes: { gap: 6, marginTop: 10 },
});
