import { Pressable, StyleSheet } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { formatDuration } from '@/lib/time';
import { useTheme } from '@/theme';

export interface TimestampButtonProps {
  /** Seconds on the sermon timeline. */
  seconds: number;
  onPress: (positionMs: number) => void;
}

/** Small "▶ 12:34" control that opens the sermon at that moment. */
export function TimestampButton({ seconds, onPress }: TimestampButtonProps) {
  const { colors } = useTheme();
  const ms = Math.round(seconds * 1000);
  const label = formatDuration(ms);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Play from ${label}`}
      hitSlop={10}
      onPress={() => onPress(ms)}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="play" size={11} color={colors.primaryText} />
      <FaithText variant="caption" weight="600" style={[styles.text, { color: colors.primaryText }]}>
        {label}
      </FaithText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontVariant: ['tabular-nums'] },
});
