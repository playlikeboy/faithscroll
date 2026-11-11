import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import type { HighlightColorValue } from '@/features/bible/annotations/highlights';
import { HIGHLIGHT_COLORS, MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { HIGHLIGHT_NAMES } from './verse-label';

export interface HighlightSwatchesProps {
  /** Colour shared by the whole selection, or null. */
  selected: HighlightColorValue | null;
  /** True when any verse in the selection is highlighted (enables "Remove"). */
  hasHighlight: boolean;
  isDisabled?: boolean;
  onSelect: (color: HighlightColorValue) => void;
  onRemove: () => void;
}

const SWATCH_SIZE = 36;

/** Four highlight colours plus remove. Each swatch is labelled by name, never by colour alone. */
export function HighlightSwatches({ selected, hasHighlight, isDisabled = false, onSelect, onRemove }: HighlightSwatchesProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Highlight colour">
      {HIGHLIGHT_COLORS.map((color) => {
        const isSelected = selected === color;
        return (
          <Pressable
            key={color}
            accessibilityRole="radio"
            accessibilityLabel={`Highlight ${HIGHLIGHT_NAMES[color].toLowerCase()}`}
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            disabled={isDisabled}
            onPress={() => onSelect(color)}
            style={({ pressed }) => [styles.item, (pressed || isDisabled) && styles.dimmed]}>
            <View
              style={[
                styles.swatch,
                {
                  backgroundColor: colors.highlight[color],
                  borderColor: isSelected ? colors.primaryText : colors.border,
                  borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth * 2,
                },
              ]}>
              {isSelected ? <Icon name="check" size={16} color={colors.primaryText} /> : null}
            </View>
            <FaithText variant="caption">{HIGHLIGHT_NAMES[color]}</FaithText>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove highlight"
        accessibilityState={{ disabled: isDisabled || !hasHighlight }}
        disabled={isDisabled || !hasHighlight}
        onPress={onRemove}
        style={({ pressed }) => [styles.item, (pressed || isDisabled || !hasHighlight) && styles.dimmed]}>
        <View style={[styles.swatch, { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2 }]}>
          <Icon name="close" size={16} color={colors.textSecondary} />
        </View>
        <FaithText variant="caption">Remove</FaithText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  item: { alignItems: 'center', gap: 4, minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET },
  dimmed: { opacity: 0.45 },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
