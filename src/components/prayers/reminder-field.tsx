import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/journal/date-time-field';
import { FaithButton, FaithText } from '@/components/ui';
import { formatDateTime } from '@/features/journal/dates';
import { isReminderUpcoming, type ReminderOutcome } from '@/features/prayers/reminders';
import { PRAYER_REMINDER_BODY } from '@/features/prayers/types';

export interface ReminderFieldProps {
  reminderAt: string | null;
  onSet: (date: Date | null) => Promise<ReminderOutcome>;
}

const DEFAULT_REMINDER_HOUR = 8;

function tomorrowMorning(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, DEFAULT_REMINDER_HOUR, 0, 0);
}

/**
 * Optional one-time reminder. Permission is only requested when the user sets one, and the
 * notification text is always generic.
 */
export function ReminderField({ reminderAt, onSet }: ReminderFieldProps) {
  const [choosing, setChoosing] = useState<Date | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const upcoming = isReminderUpcoming(reminderAt);
  const current = upcoming && reminderAt ? new Date(reminderAt) : null;

  const apply = async (date: Date | null) => {
    setIsBusy(true);
    try {
      const outcome = await onSet(date);
      if (outcome === 'scheduled' || outcome === 'cleared') setChoosing(null);
    } finally {
      setIsBusy(false);
    }
  };

  const minimumDate = new Date();

  return (
    <View style={styles.container}>
      <FaithText variant="label" accessibilityRole="header">
        Reminder
      </FaithText>
      {current ? (
        <>
          <DateTimeField
            label="Remind me"
            icon="bell"
            mode="datetime"
            value={current}
            displayValue={formatDateTime(reminderAt)}
            minimumDate={minimumDate}
            onChange={(date) => void apply(date)}
          />
          <FaithButton label="Remove reminder" variant="ghost" onPress={() => void apply(null)} isLoading={isBusy} style={styles.ghost} />
        </>
      ) : choosing ? (
        <>
          <DateTimeField
            label="Remind me"
            icon="bell"
            mode="datetime"
            value={choosing}
            displayValue={formatDateTime(choosing.toISOString())}
            minimumDate={minimumDate}
            onChange={setChoosing}
          />
          <View style={styles.actions}>
            <FaithButton label="Cancel" variant="secondary" onPress={() => setChoosing(null)} />
            <FaithButton label="Set reminder" icon="bell" onPress={() => void apply(choosing)} isLoading={isBusy} />
          </View>
        </>
      ) : (
        <FaithButton label="Add a reminder" icon="bell" variant="ghost" onPress={() => setChoosing(tomorrowMorning())} style={styles.ghost} />
      )}
      <FaithText variant="caption">Notifications only say “{PRAYER_REMINDER_BODY}”. Your prayer stays private.</FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  ghost: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
});
