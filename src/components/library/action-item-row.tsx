import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import type { ActionItemRow } from '@/features/library/action-items';
import type { ActionSource } from '@/features/library/action-sources';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { formatDateTimeValue } from './date-time-field';

export interface ActionItemRowProps {
  item: ActionItemRow;
  source: ActionSource | undefined;
  onToggle: () => void;
  onEdit: () => void;
}

function details(item: ActionItemRow): string[] {
  const parts: string[] = [];
  if (item.dueAt) parts.push(`Due ${formatDateTimeValue(new Date(item.dueAt), 'date')}`);
  if (item.reminderNotificationId && item.reminderAt && item.completedAt === null) {
    parts.push(`Reminder ${formatDateTimeValue(new Date(item.reminderAt), 'datetime')}`);
  }
  if (item.completedAt) parts.push(`Done ${formatDateTimeValue(new Date(item.completedAt), 'date')}`);
  return parts;
}

export function ActionItemRowView({ item, source, onToggle, onEdit }: ActionItemRowProps) {
  const { colors } = useTheme();
  const isDone = item.completedAt !== null;
  const meta = details(item).join(' · ');
  const boxStyle = { borderColor: isDone ? colors.primary : colors.border, backgroundColor: isDone ? colors.primary : 'transparent' };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={item.title}
        accessibilityHint={isDone ? 'Marks the action as not done' : 'Marks the action as done'}
        accessibilityState={{ checked: isDone }}
        onPress={onToggle}
        hitSlop={6}
        style={styles.check}>
        <View style={[styles.box, boxStyle]}>{isDone ? <Icon name="check" size={14} color={colors.onPrimary} /> : null}</View>
      </Pressable>
      <View style={styles.body}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={meta ? `Edit ${item.title}, ${meta}` : `Edit ${item.title}`}
          onPress={onEdit}
          style={({ pressed }) => [styles.text, pressed && styles.pressed]}>
          <FaithText variant="body" color={isDone ? 'textSecondary' : 'text'} style={isDone ? styles.done : undefined}>
            {item.title}
          </FaithText>
          {meta ? <FaithText variant="caption">{meta}</FaithText> : null}
        </Pressable>
        {source ? (
          <Pressable accessibilityRole="link" accessibilityLabel={source.label} onPress={() => router.push(source.href)} hitSlop={8}>
            <FaithText variant="secondary" weight="600" color="primaryText" numberOfLines={1}>
              {source.label}
            </FaithText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  check: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 6, paddingTop: 10 },
  text: { gap: 2 },
  pressed: { opacity: 0.6 },
  done: { textDecorationLine: 'line-through' },
});
