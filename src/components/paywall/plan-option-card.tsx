import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import type { PlanOption } from '@/services/payments/offerings';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface PlanOptionCardProps {
  option: PlanOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function accessibleLabel(option: PlanOption): string {
  const parts = [option.title, `${option.priceString} ${option.periodLabel}`];
  if (option.monthlyEquivalent) parts.push(`about ${option.monthlyEquivalent} a month`);
  if (option.trialLabel) parts.push(`includes a ${option.trialLabel}`);
  return parts.join(', ');
}

/** One selectable plan (radio). Selection is shown by border, icon and screen-reader state, not colour alone. */
export function PlanOptionCard({ option, isSelected, onSelect }: PlanOptionCardProps) {
  const { colors, radii } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibleLabel(option)}
      accessibilityState={{ checked: isSelected, selected: isSelected }}
      onPress={() => onSelect(option.id)}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: isSelected ? colors.primary : colors.border,
          borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth * 2,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Icon
        name={isSelected ? 'check' : 'forward'}
        size={18}
        color={isSelected ? colors.primaryText : colors.textTertiary}
      />
      <View style={styles.text}>
        <FaithText variant="heading">{option.title}</FaithText>
        {option.monthlyEquivalent ? (
          <FaithText variant="secondary">{`${option.monthlyEquivalent} a month, billed yearly`}</FaithText>
        ) : null}
        {option.trialLabel ? (
          <FaithText variant="secondary" color="primaryText" weight="600">
            {option.trialLabel}
          </FaithText>
        ) : null}
      </View>
      <View style={styles.price}>
        <FaithText variant="heading" align="right">
          {option.priceString}
        </FaithText>
        <FaithText variant="caption" align="right">
          {option.periodLabel}
        </FaithText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    minHeight: MIN_TOUCH_TARGET + 20,
  },
  text: { flex: 1, gap: 2 },
  price: { alignItems: 'flex-end', gap: 2 },
});
