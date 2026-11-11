import { Linking, StyleSheet, Switch, View } from 'react-native';

import { Card, Divider, FaithButton, FaithText, ListRow } from '@/components/ui';
import type { DailyReminderSettings } from '@/features/reminders/use-daily-reminder-settings';
import {
  dateToTimeOfDay,
  formatTimeLabel,
  formatTimeOfDay,
  parseTimeOfDay,
  timeOfDayToDate,
} from '@/features/reminders/time-of-day';
import { useTheme } from '@/theme';

import { DateTimeField } from './date-time-field';

export interface DailyReminderSectionProps {
  settings: DailyReminderSettings;
}

function PermissionHint({ settings }: DailyReminderSectionProps) {
  const needsPermission = settings.enabled && !settings.isScheduled;
  if (settings.permission === 'denied' && (settings.enabled || settings.message)) {
    return (
      <View style={styles.hint}>
        <FaithText variant="secondary">
          Notifications are turned off for Faithscroll. You can allow them in your device settings whenever you like.
        </FaithText>
        <FaithButton label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
      </View>
    );
  }
  if (!needsPermission) return null;
  return (
    <View style={styles.hint}>
      <FaithText variant="secondary">Allow notifications so this reminder can reach you.</FaithText>
      <FaithButton
        label="Allow notifications"
        variant="secondary"
        isLoading={settings.isBusy}
        onPress={() => void settings.setEnabled(true)}
      />
    </View>
  );
}

export function DailyReminderSection({ settings }: DailyReminderSectionProps) {
  const { colors } = useTheme();
  const time = parseTimeOfDay(settings.time) ?? { hour: 8, minute: 0 };
  const subtitle = settings.enabled ? `Every day at ${formatTimeLabel(time)}` : 'Off';

  return (
    <Card>
      <ListRow
        icon="bell"
        title="Daily reading reminder"
        subtitle={subtitle}
        trailing={
          <Switch
            accessibilityRole="switch"
            accessibilityLabel="Daily reading reminder"
            accessibilityState={{ checked: settings.enabled, disabled: settings.isBusy }}
            value={settings.enabled}
            disabled={settings.isBusy}
            trackColor={{ true: colors.primary, false: colors.border }}
            onValueChange={(value) => void settings.setEnabled(value)}
          />
        }
      />
      <Divider />
      <DateTimeField
        label="Time"
        mode="time"
        value={timeOfDayToDate(time)}
        isDisabled={settings.isBusy}
        onChange={(date) => void settings.setTime(formatTimeOfDay(dateToTimeOfDay(date)))}
      />
      {settings.message && settings.permission !== 'denied' ? (
        <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite" style={styles.message}>
          {settings.message}
        </FaithText>
      ) : null}
      <PermissionHint settings={settings} />
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: { gap: 10, paddingTop: 12 },
  message: { paddingTop: 8 },
});
