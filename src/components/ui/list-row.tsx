import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { FaithText } from './text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Text or control shown on the right (e.g. a Switch or a value). */
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
}

export function ListRow({ title, subtitle, icon, trailing, onPress, showChevron = !!onPress, destructive, accessibilityHint }: ListRowProps) {
  const { colors } = useTheme();
  const body = (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={20} color={destructive ? colors.danger : colors.primaryText} /> : null}
      <View style={styles.text}>
        <FaithText variant="body" color={destructive ? 'danger' : 'text'} numberOfLines={2}>
          {title}
        </FaithText>
        {subtitle ? (
          <FaithText variant="secondary" numberOfLines={2}>
            {subtitle}
          </FaithText>
        ) : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="forward" size={14} color={colors.textTertiary} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET + 8, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
});
