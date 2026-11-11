import { Pressable, StyleSheet } from 'react-native';

import { FaithText, Icon, type IconName } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface CardActionProps {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  /** Toggle state (e.g. saved); omit for plain actions. */
  isSelected?: boolean;
  onPress: () => void;
}

/** Quiet inline action (icon + short label) used on Scripture cards. */
export function CardAction({ icon, label, accessibilityLabel, isSelected, onPress }: CardActionProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={isSelected === undefined ? undefined : { selected: isSelected }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={18} color={colors.primaryText} />
      <FaithText variant="secondary" weight="600" color="primaryText">
        {label}
      </FaithText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 8,
  },
});
