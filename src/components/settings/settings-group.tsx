import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Divider, FaithText } from '@/components/ui';
import { useTheme } from '@/theme';

export interface SettingsGroupProps {
  title: string;
  footer?: string;
  children: ReactNode;
}

/** A labelled card of settings rows, separated by hairlines. */
export function SettingsGroup({ title, footer, children }: SettingsGroupProps) {
  const { colors, radii } = useTheme();
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={styles.group}>
      <FaithText variant="label" accessibilityRole="header" style={styles.title}>
        {title}
      </FaithText>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg }]}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <Divider /> : null}
            {row}
          </View>
        ))}
      </View>
      {footer ? (
        <FaithText variant="caption" style={styles.footer}>
          {footer}
        </FaithText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 24, gap: 8 },
  title: { marginLeft: 4 },
  card: { paddingHorizontal: 16, borderWidth: StyleSheet.hairlineWidth },
  footer: { marginHorizontal: 4 },
});
