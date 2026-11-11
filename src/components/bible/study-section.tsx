import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface StudySectionProps {
  title: string;
  children: ReactNode;
  isInitiallyOpen?: boolean;
}

/** Collapsible editorial section for the study screen. */
export function StudySection({ title, children, isInitiallyOpen = true }: StudySectionProps) {
  const { colors } = useTheme();
  const [isOpen, setOpen] = useState(isInitiallyOpen);
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isOpen }}
        accessibilityHint={isOpen ? 'Collapses this section' : 'Expands this section'}
        onPress={() => setOpen((open) => !open)}
        style={styles.header}>
        <FaithText variant="title" accessibilityRole="header" style={styles.title}>
          {title}
        </FaithText>
        <Icon name={isOpen ? 'down' : 'forward'} size={14} color={colors.textSecondary} />
      </Pressable>
      {isOpen ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET, gap: 8 },
  title: { flex: 1 },
  body: { gap: 12, paddingBottom: 8 },
});
