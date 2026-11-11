import { Stack } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';

import { ActiveReminderList } from '@/components/library/active-reminder-list';
import { DailyReminderSection } from '@/components/library/daily-reminder-section';
import { ErrorState, FaithText, Screen, Section } from '@/components/ui';
import { db } from '@/db/client';
import { useLiveData } from '@/features/library/use-live-data';
import { ACTIVE_REMINDER_TABLES, listActiveReminders } from '@/features/reminders/active-reminders';
import { useDailyReminderSettings } from '@/features/reminders/use-daily-reminder-settings';

export default function RemindersSettingsScreen() {
  const settings = useDailyReminderSettings();
  const read = useCallback(() => listActiveReminders(db), []);
  const { data: reminders, error } = useLiveData(read, ACTIVE_REMINDER_TABLES);

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Reminders' }} />
      <FaithText variant="secondary" style={styles.intro}>
        Reminders are always optional. Choose what helps you, and change it any time.
      </FaithText>

      <Section title="Daily reading">
        <DailyReminderSection settings={settings} />
      </Section>

      {error ? (
        <ErrorState message="We couldn’t load your other reminders. Please try again later." />
      ) : (
        <>
          <Section title="Reading plans">
            <ActiveReminderList
              reminders={reminders?.plans ?? []}
              emptyMessage="No plan reminders. You can add one from any reading plan you’ve started."
            />
          </Section>
          <Section title="Prayers">
            <ActiveReminderList
              reminders={reminders?.prayers ?? []}
              emptyMessage="No upcoming prayer reminders. You can set one on any prayer."
            />
          </Section>
          <Section title="Action items">
            <ActiveReminderList
              reminders={reminders?.actions ?? []}
              emptyMessage="No upcoming action reminders."
            />
          </Section>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingTop: 16 },
});
