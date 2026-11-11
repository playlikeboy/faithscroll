import { StyleSheet, View } from 'react-native';

import { Card, FaithText } from '@/components/ui';
import { describePlanStatus, type PlanWithProgress } from '@/features/plans/plan-views';

import { PlanProgressBar } from './plan-progress-bar';

export interface PlanCardProps {
  item: PlanWithProgress;
  onPress: () => void;
}

export function PlanCard({ item, onPress }: PlanCardProps) {
  const status = describePlanStatus(item);
  const label = [item.plan.title, status ?? item.plan.summary].join(', ');
  return (
    <Card onPress={onPress} accessibilityLabel={label} accessibilityHint="Opens the reading plan">
      <View style={styles.body}>
        <FaithText variant="title">{item.plan.title}</FaithText>
        <FaithText variant="secondary">{item.plan.summary}</FaithText>
        {status ? (
          <>
            <FaithText variant="label">{status}</FaithText>
            <PlanProgressBar completed={item.summary.completedCount} total={item.summary.totalDays} />
          </>
        ) : (
          <FaithText variant="secondary" numberOfLines={2}>
            {item.plan.description}
          </FaithText>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: 6 },
});
