import { StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { useTheme } from '@/theme';

export interface AiLabelProps {
  /** e.g. "AI-generated from your recording". */
  text?: string;
}

/** Visible marker on every piece of AI content (never conveyed by colour alone). */
export function AiLabel({ text = 'AI-generated' }: AiLabelProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={text}>
      <Icon name="sparkles" size={14} color={colors.primaryText} />
      <FaithText variant="label" style={{ color: colors.primaryText }}>
        {text}
      </FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
