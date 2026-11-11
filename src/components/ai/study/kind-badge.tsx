import { StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { useTheme } from '@/theme';

export type KindValue = 'text' | 'interpretation' | 'mixed';

const LABELS: Record<KindValue, string> = {
  text: 'From the text',
  interpretation: 'Interpretation',
  mixed: 'Text and interpretation',
};

/** Distinguishes what the passage says from interpretation (icon + words, not colour alone). */
export function KindBadge({ kind }: { kind: KindValue }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]} accessible accessibilityRole="text" accessibilityLabel={LABELS[kind]}>
      <Icon name={kind === 'text' ? 'bible' : 'sparkles'} size={12} color={colors.textSecondary} />
      <FaithText variant="caption" weight="600">
        {LABELS[kind]}
      </FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
