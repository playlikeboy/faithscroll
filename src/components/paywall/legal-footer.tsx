import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface LegalFooterProps {
  /** Auto-renewal disclosure for the selected plan, when one is shown. */
  disclosure: string | null;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.link}>
      <FaithText variant="secondary" weight="600" style={{ color: colors.primaryText, textDecorationLine: 'underline' }}>
        {label}
      </FaithText>
    </Pressable>
  );
}

export function LegalFooter({ disclosure, onOpenTerms, onOpenPrivacy }: LegalFooterProps) {
  return (
    <View style={styles.footer}>
      {disclosure ? <FaithText variant="caption">{disclosure}</FaithText> : null}
      <View style={styles.links}>
        <LegalLink label="Terms of Use" onPress={onOpenTerms} />
        <LegalLink label="Privacy Policy" onPress={onOpenPrivacy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 8 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  link: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
});
