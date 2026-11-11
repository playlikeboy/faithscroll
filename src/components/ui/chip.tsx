import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { FaithText } from './text';

export interface ChipProps {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  isSelected?: boolean;
  accessibilityHint?: string;
}

/** Pill used for tags, filters and Scripture reference chips. */
export function Chip({ label, onPress, icon, isSelected = false, accessibilityHint }: ChipProps) {
  const { colors } = useTheme();
  const fg = isSelected ? colors.onPrimary : colors.primaryText;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={onPress ? { selected: isSelected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <FaithText variant="secondary" weight="600" style={{ color: fg }}>
        {label}
      </FaithText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    minHeight: 32,
  },
});
