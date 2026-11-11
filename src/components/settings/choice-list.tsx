import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface Choice<T extends string> {
  value: T;
  title: string;
  description?: string;
}

export interface ChoiceListProps<T extends string> {
  /** Announced as the group's name. */
  label: string;
  choices: readonly Choice<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
}

/** Single-choice list announced as radio buttons (theme, reading goal…). */
export function ChoiceList<T extends string>({ label, choices, selected, onSelect }: ChoiceListProps<T>) {
  const { colors, radii } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.list}>
      {choices.map((choice) => {
        const isSelected = choice.value === selected;
        return (
          <Pressable
            key={choice.value}
            accessibilityRole="radio"
            accessibilityLabel={choice.description ? `${choice.title}. ${choice.description}` : choice.title}
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            onPress={() => onSelect(choice.value)}
            style={({ pressed }) => [
              styles.option,
              {
                borderRadius: radii.md,
                backgroundColor: colors.surface,
                borderColor: isSelected ? colors.primaryText : colors.border,
                borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth * 2,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <View style={styles.text}>
              <FaithText variant="heading">{choice.title}</FaithText>
              {choice.description ? <FaithText variant="secondary">{choice.description}</FaithText> : null}
            </View>
            <View
              style={[
                styles.indicator,
                { borderColor: isSelected ? colors.primaryText : colors.textTertiary },
                isSelected && { backgroundColor: colors.primary },
              ]}>
              {isSelected ? <Icon name="check" size={13} color={colors.onPrimary} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET + 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: { flex: 1, gap: 2 },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
