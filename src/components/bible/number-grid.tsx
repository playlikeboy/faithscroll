import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface NumberGridProps {
  count: number;
  /** Noun used in accessibility labels, e.g. "Chapter" → "Chapter 3". */
  noun: string;
  onSelect: (value: number) => void;
  /** Highlighted numbers (e.g. the current chapter or a chosen verse range). */
  isSelected?: (value: number) => boolean;
  /** Numbers below this are disabled (e.g. end verse before the start verse). */
  minimum?: number;
}

const CELL_SIZE = 52;

/** Grid of chapter or verse numbers with 44pt+ targets. */
export function NumberGrid({ count, noun, onSelect, isSelected, minimum = 1 }: NumberGridProps) {
  const { colors, radii } = useTheme();
  const numbers = Array.from({ length: Math.max(0, count) }, (_, index) => index + 1);
  return (
    <View style={styles.grid}>
      {numbers.map((value) => {
        const selected = isSelected?.(value) ?? false;
        const disabled = value < minimum;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`${noun} ${value}`}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(value)}
            style={({ pressed }) => [
              styles.cell,
              {
                borderRadius: radii.md,
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: colors.border,
                opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
              },
            ]}>
            <FaithText variant="body" weight="600" style={{ color: selected ? colors.onPrimary : colors.text }}>
              {value}
            </FaithText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: {
    minWidth: CELL_SIZE,
    minHeight: Math.max(CELL_SIZE, MIN_TOUCH_TARGET),
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
