import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Two-to-four option switch announced as tabs. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const { colors, radii } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              { borderRadius: radii.sm },
              isSelected && { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <FaithText variant="secondary" weight={isSelected ? '600' : '400'} color={isSelected ? 'text' : 'textSecondary'}>
              {option.label}
            </FaithText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
});
