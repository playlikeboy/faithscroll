import { StyleSheet, View } from 'react-native';

import { FaithText, Icon, type IconName } from '@/components/ui';
import type { FlowMessage } from '@/features/subscriptions/use-purchase-flow';
import { useTheme } from '@/theme';

const ICON_BY_TONE: Record<FlowMessage['tone'], IconName> = {
  success: 'check',
  info: 'info',
  error: 'warning',
};

/** Inline, announced status text for purchase/restore results. */
export function StatusMessage({ message }: { message: FlowMessage | null }) {
  const { colors, radii } = useTheme();
  if (!message) return null;
  const color = message.tone === 'error' ? colors.danger : colors.primaryText;
  return (
    <View
      style={[styles.box, { backgroundColor: colors.surfaceMuted, borderRadius: radii.md }]}
      accessible
      accessibilityRole={message.tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      accessibilityLabel={message.text}>
      <Icon name={ICON_BY_TONE[message.tone]} size={18} color={color} />
      <FaithText variant="secondary" color="text" style={styles.text}>
        {message.text}
      </FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10, padding: 12, alignItems: 'flex-start' },
  text: { flex: 1 },
});
