import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon, type IconName } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  mode?: 'date' | 'datetime';
  /** Text shown for the value on Android (where the picker is a dialog). */
  displayValue: string;
  icon?: IconName;
  minimumDate?: Date;
  maximumDate?: Date;
}

function openAndroidPicker({ value, mode, onChange, minimumDate, maximumDate }: DateTimeFieldProps): void {
  DateTimePickerAndroid.open({
    value,
    mode: 'date',
    minimumDate,
    maximumDate,
    onValueChange: (_event, date) => {
      if (mode !== 'datetime') {
        onChange(date);
        return;
      }
      DateTimePickerAndroid.open({ value: date, mode: 'time', onValueChange: (_e, time) => onChange(time) });
    },
  });
}

/**
 * Labelled date (or date + time) control. iOS shows the native compact picker inline;
 * Android opens the system dialog(s) from a pressable row.
 */
export function DateTimeField(props: DateTimeFieldProps) {
  const { label, value, onChange, mode = 'date', displayValue, icon = 'calendar', minimumDate, maximumDate } = props;
  const { colors, scheme } = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <Icon name={icon} size={18} color={colors.primaryText} />
        <FaithText variant="body" style={styles.label}>
          {label}
        </FaithText>
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={colors.primaryText}
          themeVariant={scheme}
          accessibilityLabel={label}
          onValueChange={(_event, date) => onChange(date)}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${displayValue}`}
      accessibilityHint="Opens a date picker"
      onPress={() => openAndroidPicker({ ...props, mode })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Icon name={icon} size={18} color={colors.primaryText} />
      <FaithText variant="body" style={styles.label}>
        {label}
      </FaithText>
      <FaithText variant="secondary" weight="600">
        {displayValue}
      </FaithText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET + 4 },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
