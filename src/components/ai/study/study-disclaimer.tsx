import { StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { useTheme } from '@/theme';

/** Shown under every AI study and answer (PRD §7 theological integrity). */
export function StudyDisclaimer() {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityRole="text">
      <Icon name="info" size={14} color={colors.textSecondary} />
      <FaithText variant="caption" style={styles.text}>
        AI-generated study aid. It can make mistakes and offers interpretation, not divine authority. Read the passage itself, and for
        important doctrinal or personal questions, talk with a pastor you trust.
      </FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  text: { flex: 1 },
});
