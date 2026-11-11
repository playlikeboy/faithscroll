import { StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import type { FeatureLine } from '@/features/subscriptions/plan-content';
import { useTheme } from '@/theme';

export interface FeatureListProps {
  items: readonly FeatureLine[];
  /** `free` uses a check mark, `plus` a sparkle; both are decorative (text carries the meaning). */
  tone: 'free' | 'plus';
}

export function FeatureList({ items, tone }: FeatureListProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View
          key={item.title}
          style={styles.row}
          accessible
          accessibilityLabel={item.detail ? `${item.title}. ${item.detail}` : item.title}>
          <Icon
            name={tone === 'free' ? 'check' : 'sparkles'}
            size={18}
            color={tone === 'free' ? colors.primaryText : colors.gold}
            style={styles.icon}
          />
          <View style={styles.text}>
            <FaithText variant="body" weight="600">
              {item.title}
            </FaithText>
            {item.detail ? <FaithText variant="secondary">{item.detail}</FaithText> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { marginTop: 3 },
  text: { flex: 1, gap: 2 },
});
