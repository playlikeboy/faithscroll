import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon, type IconName } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface LibraryRowProps {
  icon: IconName;
  title: string;
  /** Live count; undefined while loading. */
  count?: number;
  /** Screen-reader noun for the count, e.g. "saved verses". */
  countLabel?: string;
  onPress: () => void;
}

/** A Library section entry: icon, title, count and chevron. */
export function LibraryRow({ icon, title, count, countLabel, onPress }: LibraryRowProps) {
  const { colors } = useTheme();
  const spoken = count === undefined ? title : `${title}, ${count} ${countLabel ?? (count === 1 ? 'item' : 'items')}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name={icon} size={18} color={colors.primaryText} />
      </View>
      <FaithText variant="body" style={styles.title}>
        {title}
      </FaithText>
      {count !== undefined ? (
        <FaithText variant="secondary" style={styles.count}>
          {count}
        </FaithText>
      ) : null}
      <Icon name="forward" size={14} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET + 8, paddingVertical: 8 },
  pressed: { opacity: 0.6 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  count: { fontVariant: ['tabular-nums'] },
});
