import { StyleSheet, View } from 'react-native';

import { Card, ErrorState, FaithButton, FaithText, LoadingState } from '@/components/ui';
import type { PlansState } from '@/features/subscriptions/use-paywall';

import { PlanOptionCard } from './plan-option-card';

export interface PlanPickerProps {
  plans: PlansState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PlanPicker({ plans, selectedId, onSelect }: PlanPickerProps) {
  switch (plans.kind) {
    case 'unavailable':
      return (
        <Card tone="muted">
          <FaithText variant="heading">Subscriptions aren’t available in this version</FaithText>
          <FaithText variant="secondary" style={styles.gap}>
            You can keep using every free feature. Plus can be purchased in the App Store or Google Play version of
            Faithscroll.
          </FaithText>
        </Card>
      );
    case 'loading':
      return <LoadingState label="Loading plans" />;
    case 'error':
      return (
        <ErrorState
          title="We couldn’t load the plans"
          message="Check your connection and try again. Nothing has been charged."
          onRetry={plans.retry}
        />
      );
    case 'empty':
      return (
        <Card tone="muted">
          <FaithText variant="heading">Plans aren’t available right now</FaithText>
          <FaithText variant="secondary" style={styles.gap}>
            Please try again later.
          </FaithText>
          <FaithButton label="Try again" variant="secondary" onPress={plans.retry} style={styles.gap} />
        </Card>
      );
    case 'ready':
      return (
        <View accessibilityRole="radiogroup" accessibilityLabel="Choose a plan" style={styles.list}>
          {plans.options.map((option) => (
            <PlanOptionCard
              key={option.id}
              option={option}
              isSelected={option.id === (selectedId ?? plans.options[0]?.id)}
              onSelect={onSelect}
            />
          ))}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  gap: { marginTop: 8 },
});
