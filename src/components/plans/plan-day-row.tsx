import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { formatDayReadings } from '@/features/plans/format';
import type { PlanDay } from '@/features/plans/types';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface PlanDayRowProps {
  day: PlanDay;
  isRead: boolean;
  isCurrent: boolean;
  /** Toggling is only possible once the plan has been started. */
  canToggle: boolean;
  isDisabled?: boolean;
  onOpen: () => void;
  onToggle: () => void;
}

export function PlanDayRow({ day, isRead, isCurrent, canToggle, isDisabled = false, onOpen, onToggle }: PlanDayRowProps) {
  const { colors } = useTheme();
  const readings = formatDayReadings(day.readings);
  const title = day.theme ? `Day ${day.day} · ${day.theme}` : `Day ${day.day}`;
  const boxStyle = {
    borderColor: isRead ? colors.primary : colors.border,
    backgroundColor: isRead ? colors.primary : 'transparent',
  };

  return (
    <View style={styles.row}>
      {canToggle ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Day ${day.day} read`}
          accessibilityState={{ checked: isRead, disabled: isDisabled }}
          disabled={isDisabled}
          onPress={onToggle}
          hitSlop={6}
          style={styles.check}>
          <View style={[styles.box, boxStyle]}>{isRead ? <Icon name="check" size={14} color={colors.onPrimary} /> : null}</View>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${readings}${isCurrent ? ', up next' : ''}`}
        accessibilityHint="Opens the reading"
        onPress={onOpen}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
        <FaithText variant="heading" color={isCurrent ? 'primaryText' : 'text'}>
          {title}
        </FaithText>
        <FaithText variant="secondary">{readings}</FaithText>
      </Pressable>
      {isCurrent ? <FaithText variant="label">Up next</FaithText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET + 8, paddingVertical: 8 },
  check: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
});
