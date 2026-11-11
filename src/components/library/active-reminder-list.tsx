import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { Card, Divider, FaithText, ListRow, type IconName } from '@/components/ui';
import type { ActiveReminder, ActiveReminderKind } from '@/features/reminders/active-reminders';
import { formatTimeLabel, parseTimeOfDay } from '@/features/reminders/time-of-day';

const KIND_ICONS: Record<ActiveReminderKind, IconName> = {
  plan: 'plan',
  prayer: 'prayer',
  action: 'action',
};

export function describeSchedule(reminder: ActiveReminder): string {
  if (reminder.schedule.type === 'daily') {
    const time = parseTimeOfDay(reminder.schedule.time);
    return time ? `Every day at ${formatTimeLabel(time)}` : 'Every day';
  }
  const at = new Date(reminder.schedule.at);
  const date = at.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
}

export interface ActiveReminderListProps {
  reminders: readonly ActiveReminder[];
  emptyMessage: string;
}

export function ActiveReminderList({ reminders, emptyMessage }: ActiveReminderListProps) {
  if (reminders.length === 0) {
    return <FaithText variant="secondary">{emptyMessage}</FaithText>;
  }
  return (
    <Card>
      {reminders.map((reminder, index) => (
        <View key={`${reminder.kind}-${reminder.id}`}>
          {index > 0 ? <Divider /> : null}
          <ListRow
            icon={KIND_ICONS[reminder.kind]}
            title={reminder.title}
            subtitle={describeSchedule(reminder)}
            onPress={() => router.push(reminder.href as Href)}
          />
        </View>
      ))}
    </Card>
  );
}
