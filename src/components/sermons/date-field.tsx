import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { formatSermonDate, isValidSermonDate } from '@/features/sermons/format';
import { toLocalDateString } from '@/lib/time';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface DateFieldProps {
  label: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function toDate(value: string): Date {
  if (!isValidSermonDate(value)) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Calendar date field: compact row that opens the native date picker. */
export function DateField({ label, value, onChange, error }: DateFieldProps) {
  const { colors, radii, scheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const display = formatSermonDate(value) ?? 'Choose a date';

  const handlePress = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'date',
        onValueChange: (_event, date) => onChange(toLocalDateString(date)),
      });
      return;
    }
    setIsOpen((open) => !open);
  };

  return (
    <View style={styles.field}>
      <FaithText variant="label">{label}</FaithText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${display}`}
        accessibilityHint="Opens a date picker"
        accessibilityState={{ expanded: Platform.OS === 'ios' ? isOpen : undefined }}
        onPress={handlePress}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border, borderRadius: radii.md }]}>
        <Icon name="calendar" size={18} color={colors.primaryText} />
        <FaithText variant="body" style={styles.value}>
          {display}
        </FaithText>
        <FaithText variant="secondary" weight="600" style={{ color: colors.primaryText }}>
          {isOpen ? 'Done' : 'Change'}
        </FaithText>
      </Pressable>
      {isOpen && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display="inline"
          themeVariant={scheme}
          accentColor={colors.primaryText}
          onValueChange={(_event, date) => onChange(toLocalDateString(date))}
        />
      ) : null}
      {error ? (
        <FaithText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </FaithText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: MIN_TOUCH_TARGET + 4,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  value: { flex: 1 },
});
