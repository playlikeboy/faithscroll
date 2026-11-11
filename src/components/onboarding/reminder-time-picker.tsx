import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, View } from 'react-native';

import { FaithButton, FaithText } from '@/components/ui';
import { dateToTime, formatTime, timeToDate } from '@/features/onboarding/reminder-time';
import { useTheme } from '@/theme';

export interface ReminderTimePickerProps {
  /** "HH:mm" */
  value: string;
  onChange: (time: string) => void;
}

/** Time chooser: an inline wheel on iOS, the system dialog on Android. Never asks for permissions. */
export function ReminderTimePicker({ value, onChange }: ReminderTimePickerProps) {
  const { colors, scheme } = useTheme();
  const label = formatTime(value);

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.wrapper}>
        <DateTimePicker
          value={timeToDate(value)}
          mode="time"
          display="spinner"
          minuteInterval={5}
          themeVariant={scheme}
          textColor={colors.text}
          accentColor={colors.primaryText}
          accessibilityLabel={`Reminder time, ${label}`}
          onValueChange={(_event, date) => onChange(dateToTime(date))}
        />
      </View>
    );
  }

  const openDialog = () =>
    DateTimePickerAndroid.open({
      value: timeToDate(value),
      mode: 'time',
      onValueChange: (_event, date) => onChange(dateToTime(date)),
    });

  return (
    <View style={styles.wrapper}>
      <FaithText variant="display" align="center" accessibilityLabel={`Reminder time, ${label}`}>
        {label}
      </FaithText>
      <FaithButton label="Change time" variant="secondary" icon="timestamp" onPress={openDialog} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 16, marginTop: 8 },
});
