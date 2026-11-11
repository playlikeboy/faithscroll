import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import type { HighlightColorName } from '@/features/library/annotation-lists';
import { HIGHLIGHT_COLORS, useTheme } from '@/theme';

export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColorName, string> = {
  gold: 'Gold',
  sage: 'Sage',
  sky: 'Sky',
  rose: 'Rose',
};

export interface HighlightColorFilterProps {
  value: HighlightColorName | null;
  onChange: (value: HighlightColorName | null) => void;
}

interface FilterChipProps {
  label: string;
  swatch?: string;
  isSelected: boolean;
  onPress: () => void;
}

function FilterChip({ label, swatch, isSelected, onPress }: FilterChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={swatch ? `${label} highlights` : 'All highlights'}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch, borderColor: colors.border }]} /> : null}
      <FaithText variant="secondary" weight="600" style={{ color: isSelected ? colors.onPrimary : colors.primaryText }}>
        {label}
      </FaithText>
    </Pressable>
  );
}

/** Colour filter: every chip carries a text label, so colour is never the only cue. */
export function HighlightColorFilter({ value, onChange }: HighlightColorFilterProps) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <FilterChip label="All" isSelected={value === null} onPress={() => onChange(null)} />
      {HIGHLIGHT_COLORS.map((color) => (
        <FilterChip
          key={color}
          label={HIGHLIGHT_COLOR_LABELS[color]}
          swatch={colors.highlight[color]}
          isSelected={value === color}
          onPress={() => onChange(color)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, minHeight: 36 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth },
});
