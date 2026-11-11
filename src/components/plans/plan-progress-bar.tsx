import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

export interface PlanProgressBarProps {
  completed: number;
  total: number;
}

/** Quiet progress indicator: days read out of the plan's days (no streaks, no "behind"). */
export function PlanProgressBar({ completed, total }: PlanProgressBarProps) {
  const { colors } = useTheme();
  const ratio = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${completed} of ${total} days read`}
      accessibilityValue={{ min: 0, max: total, now: completed }}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.fill, { backgroundColor: colors.accent, width: `${ratio * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
