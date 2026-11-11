import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { FaithText } from './text';

export interface SectionProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

/** Titled group of content with an optional "See all"-style action. */
export function Section({ title, actionLabel, onAction, children }: SectionProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <FaithText variant="title" accessibilityRole="header" style={styles.title}>
          {title}
        </FaithText>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel}, ${title}`} onPress={onAction} hitSlop={12}>
            <FaithText variant="secondary" weight="600" style={{ color: colors.primaryText }}>
              {actionLabel}
            </FaithText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  section: { marginTop: 28, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
});
