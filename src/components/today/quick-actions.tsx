import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon, type IconName } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export type QuickActionKey = 'read' | 'sermon' | 'journal' | 'prayer';

const ACTIONS: readonly { key: QuickActionKey; icon: IconName; label: string }[] = [
  { key: 'read', icon: 'bible', label: 'Read the Bible' },
  { key: 'sermon', icon: 'sermons', label: 'Start a sermon' },
  { key: 'journal', icon: 'journal', label: 'New journal entry' },
  { key: 'prayer', icon: 'prayer', label: 'Write a prayer' },
];

export interface QuickActionsProps {
  onAction: (key: QuickActionKey) => void;
}

export function QuickActions({ onAction }: QuickActionsProps) {
  const { colors, radii } = useTheme();
  return (
    <View style={styles.grid}>
      {ACTIONS.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => onAction(action.key)}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.md,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <Icon name={action.icon} size={20} color={colors.primaryText} />
          <FaithText variant="secondary" weight="600" style={styles.label}>
            {action.label}
          </FaithText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: MIN_TOUCH_TARGET + 28,
    padding: 14,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  label: { flexShrink: 1 },
});
