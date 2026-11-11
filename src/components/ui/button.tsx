import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme, type Theme } from '@/theme';

import { Icon, type IconName } from './icon';
import { FaithText } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface FaithButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  isLoading?: boolean;
  isDisabled?: boolean;
  fullWidth?: boolean;
  /** Short hint for screen readers when the outcome is not obvious. */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

function palette(variant: ButtonVariant, { colors }: Theme): { bg: string; fg: string; border: string } {
  switch (variant) {
    case 'primary':
      return { bg: colors.primary, fg: colors.onPrimary, border: colors.primary };
    case 'secondary':
      return { bg: colors.surface, fg: colors.primaryText, border: colors.border };
    case 'ghost':
      return { bg: 'transparent', fg: colors.primaryText, border: 'transparent' };
    case 'destructive':
      return { bg: colors.surface, fg: colors.danger, border: colors.border };
  }
}

export function FaithButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  accessibilityHint,
  style,
}: FaithButtonProps) {
  const theme = useTheme();
  const { bg, fg, border } = palette(variant, theme);
  const disabled = isDisabled || isLoading;

  const handlePress = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: isLoading }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        fullWidth && styles.fullWidth,
        style,
      ]}>
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <FaithText variant="heading" style={{ color: fg }} numberOfLines={1}>
          {label}
        </FaithText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET + 4,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
