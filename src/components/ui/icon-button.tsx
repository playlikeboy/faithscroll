import { Pressable, StyleSheet, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';

export interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only controls have no visible text for VoiceOver. */
  accessibilityLabel: string;
  onPress: () => void;
  size?: number;
  color?: ColorValue;
  isSelected?: boolean;
  isDisabled?: boolean;
  /** Filled circular background. */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  size = 22,
  color,
  isSelected,
  isDisabled,
  filled = false,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, selected: isSelected }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        filled && { backgroundColor: colors.surfaceMuted },
        { opacity: isDisabled ? 0.4 : pressed ? 0.6 : 1 },
        style,
      ]}>
      <Icon name={icon} size={size} color={color ?? (isSelected ? colors.primaryText : colors.text)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
