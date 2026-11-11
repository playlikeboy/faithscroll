import { StyleSheet, View } from 'react-native';

import { Card, FaithText, Icon } from '@/components/ui';
import type { SubscriptionSummary } from '@/features/subscriptions/plan-content';
import { useTheme } from '@/theme';

export interface SubscriptionStatusCardProps {
  summary: SubscriptionSummary;
  isPlus: boolean;
}

export function SubscriptionStatusCard({ summary, isPlus }: SubscriptionStatusCardProps) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.header} accessible accessibilityLabel={`Current plan: ${summary.planLabel}. ${summary.detail}`}>
        <Icon name={isPlus ? 'sparkles' : 'heart'} size={20} color={isPlus ? colors.gold : colors.primaryText} />
        <View style={styles.text}>
          <FaithText variant="title">{summary.planLabel}</FaithText>
          <FaithText variant="secondary">{summary.detail}</FaithText>
        </View>
      </View>
      {summary.warning ? (
        <View style={styles.warning} accessible accessibilityRole="alert" accessibilityLabel={summary.warning}>
          <Icon name="warning" size={16} color={colors.danger} />
          <FaithText variant="secondary" color="danger" style={styles.text}>
            {summary.warning}
          </FaithText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  text: { flex: 1, gap: 4 },
  warning: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'flex-start' },
});
