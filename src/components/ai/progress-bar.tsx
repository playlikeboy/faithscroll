import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

export interface ProgressBarProps {
  /** 0–1. */
  value: number;
  label: string;
}

/** Determinate progress with an accessible value (announced as a percentage). */
export function ProgressBar({ value, label }: ProgressBarProps) {
  const { colors } = useTheme();
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
      style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
