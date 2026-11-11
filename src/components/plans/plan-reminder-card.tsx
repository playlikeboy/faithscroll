import { Switch } from 'react-native';

import { DateTimeField } from '@/components/library/date-time-field';
import { Card, Divider, ListRow } from '@/components/ui';
import {
  dateToTimeOfDay,
  DEFAULT_REMINDER_TIME,
  formatTimeLabel,
  formatTimeOfDay,
  parseTimeOfDay,
  timeOfDayToDate,
} from '@/features/reminders/time-of-day';
import { useTheme } from '@/theme';

export interface PlanReminderCardProps {
  reminderTime: string | null;
  isPaused: boolean;
  isBusy: boolean;
  onChange: (time: string | null) => void;
}

/** Optional daily reminder for a plan. */
export function PlanReminderCard({ reminderTime, isPaused, isBusy, onChange }: PlanReminderCardProps) {
  const { colors } = useTheme();
  const enabled = reminderTime !== null;
  const time = parseTimeOfDay(reminderTime ?? DEFAULT_REMINDER_TIME) ?? { hour: 8, minute: 0 };
  const subtitle = !enabled
    ? 'Off'
    : isPaused
      ? `Every day at ${formatTimeLabel(time)} · resumes with the plan`
      : `Every day at ${formatTimeLabel(time)}`;

  return (
    <Card>
      <ListRow
        icon="bell"
        title="Daily reminder"
        subtitle={subtitle}
        trailing={
          <Switch
            accessibilityRole="switch"
            accessibilityLabel="Daily reminder for this plan"
            accessibilityState={{ checked: enabled, disabled: isBusy }}
            value={enabled}
            disabled={isBusy}
            trackColor={{ true: colors.primary, false: colors.border }}
            onValueChange={(value) => onChange(value ? formatTimeOfDay(time) : null)}
          />
        }
      />
      {enabled ? (
        <>
          <Divider />
          <DateTimeField
            label="Time"
            mode="time"
            value={timeOfDayToDate(time)}
            isDisabled={isBusy}
            onChange={(date) => onChange(formatTimeOfDay(dateToTimeOfDay(date)))}
          />
        </>
      ) : null}
    </Card>
  );
}
