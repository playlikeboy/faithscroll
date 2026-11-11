import RNDateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export type DateTimeFieldMode = 'date' | 'time' | 'datetime';

export interface DateTimeFieldProps {
  label: string;
  value: Date;
  mode: DateTimeFieldMode;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  isDisabled?: boolean;
}

export function formatDateTimeValue(value: Date, mode: DateTimeFieldMode): string {
  const date = value.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const time = value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (mode === 'date') return date;
  if (mode === 'time') return time;
  return `${date}, ${time}`;
}

function openAndroidPicker({ value, mode, onChange, minimumDate }: DateTimeFieldProps): void {
  const openTime = (base: Date) =>
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      onValueChange: (_event, picked) => {
        const next = new Date(base);
        next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        onChange(next);
      },
    });

  if (mode === 'time') {
    openTime(value);
    return;
  }
  DateTimePickerAndroid.open({
    value,
    mode: 'date',
    minimumDate,
    onValueChange: (_event, picked) => {
      const next = new Date(picked);
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      if (mode === 'datetime') openTime(next);
      else onChange(next);
    },
  });
}

/** Labelled date/time control: native compact picker on iOS, dialog pickers on Android. */
export function DateTimeField(props: DateTimeFieldProps) {
  const { label, value, mode, onChange, minimumDate, isDisabled = false } = props;
  const { colors, scheme } = useTheme();
  const display = formatDateTimeValue(value, mode);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <FaithText variant="body" style={styles.label}>
          {label}
        </FaithText>
        <RNDateTimePicker
          value={value}
          mode={mode}
          display="compact"
          minimumDate={minimumDate}
          disabled={isDisabled}
          accentColor={colors.primaryText}
          themeVariant={scheme}
          accessibilityLabel={`${label}, ${display}`}
          onValueChange={(_event, picked) => onChange(picked)}
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${display}`}
      accessibilityHint="Opens a picker"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => openAndroidPicker(props)}
      style={({ pressed }) => [styles.row, { opacity: isDisabled ? 0.5 : pressed ? 0.6 : 1 }]}>
      <FaithText variant="body" style={styles.label}>
        {label}
      </FaithText>
      <View style={[styles.value, { backgroundColor: colors.surfaceMuted }]}>
        <FaithText variant="body" weight="600" style={{ color: colors.primaryText }}>
          {display}
        </FaithText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH_TARGET + 8, paddingVertical: 6 },
  label: { flex: 1 },
  value: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
});
