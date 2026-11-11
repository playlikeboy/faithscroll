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

/** Two or three mutually exclusive views (e.g. Sermons | Series). */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const { colors, radii } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, { borderRadius: radii.sm }, selected && { backgroundColor: colors.surface }]}>
            <FaithText variant="secondary" weight={selected ? '600' : '400'} color={selected ? 'text' : 'textSecondary'}>
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
  segment: { flex: 1, minHeight: MIN_TOUCH_TARGET - 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
