import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { PlanDayRow } from '@/components/plans/plan-day-row';
import { PlanOverview } from '@/components/plans/plan-overview';
import { PlanReminderCard } from '@/components/plans/plan-reminder-card';
import { Divider, EmptyState, ErrorState, FaithButton, FaithText, LoadingState, Screen, Section } from '@/components/ui';
import { readingHref } from '@/features/plans/format';
import type { PlanWithProgress } from '@/features/plans/plan-views';
import type { PlanReading } from '@/features/plans/types';
import { usePlanActions, type PlanActions } from '@/features/plans/use-plan-actions';
import { usePlan } from '@/features/plans/use-plans';
import { GUTTER } from '@/theme';

function openReading(reading: PlanReading): void {
  router.push(readingHref(reading) as Href);
}

function confirmStop(actions: PlanActions): void {
  Alert.alert('Stop this plan?', 'Its reminder will be turned off. You can start the plan again any time.', [
    { text: 'Keep plan', style: 'cancel' },
    { text: 'Stop plan', style: 'destructive', onPress: () => void actions.stop() },
  ]);
}

function PlanHeader({ item, actions }: { item: PlanWithProgress; actions: PlanActions }) {
  const { progress } = item;
  const restart = async () => {
    await actions.stop();
    await actions.start();
  };
  return (
    <View style={styles.header}>
      <FaithText variant="display" accessibilityRole="header">
        {item.plan.title}
      </FaithText>
      <FaithText variant="secondary">{item.plan.summary}</FaithText>
      <FaithText variant="bodySerif">{item.plan.description}</FaithText>
      <PlanOverview
        item={item}
        isBusy={actions.isBusy}
        onStart={() => void actions.start()}
        onResume={() => void actions.resume()}
        onOpenReading={openReading}
        onCompleteDay={(day) => void actions.toggleDay(day)}
      />
      {actions.message ? (
        <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {actions.message}
        </FaithText>
      ) : null}
      {progress && progress.status !== 'completed' ? (
        <Section title="Reminder">
          <PlanReminderCard
            reminderTime={progress.reminderTime}
            isPaused={progress.status === 'paused'}
            isBusy={actions.isBusy}
            onChange={(time) => void actions.setReminder(time)}
          />
        </Section>
      ) : null}
      {progress ? (
        <View style={styles.actions}>
          {progress.status === 'active' ? (
            <FaithButton label="Pause plan" variant="secondary" isDisabled={actions.isBusy} onPress={() => void actions.pause()} />
          ) : null}
          {progress.status === 'completed' ? (
            <FaithButton label="Read it again" variant="secondary" isDisabled={actions.isBusy} onPress={() => void restart()} />
          ) : (
            <FaithButton label="Stop plan" variant="destructive" isDisabled={actions.isBusy} onPress={() => confirmStop(actions)} />
          )}
        </View>
      ) : null}
      <FaithText variant="title" accessibilityRole="header" style={styles.daysTitle}>
        Days
      </FaithText>
    </View>
  );
}

function PlanDetail({ item }: { item: PlanWithProgress }) {
  const actions = usePlanActions(item);
  const completed = new Set(item.completedDays);
  const isActive = item.progress?.status === 'active';

  return (
    <FlatList
      data={item.plan.days}
      keyExtractor={(day) => String(day.day)}
      contentContainerStyle={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      ListHeaderComponent={<PlanHeader item={item} actions={actions} />}
      ItemSeparatorComponent={Divider}
      renderItem={({ item: day }) => (
        <PlanDayRow
          day={day}
          isRead={completed.has(day.day)}
          isCurrent={isActive && item.summary.currentDay === day.day}
          canToggle={item.progress !== undefined}
          isDisabled={actions.isBusy}
          onOpen={() => {
            const first = day.readings[0];
            if (first) openReading(first);
          }}
          onToggle={() => void actions.toggleDay(day.day)}
        />
      )}
    />
  );
}

export default function PlanScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { data, error } = usePlan(typeof planId === 'string' ? planId : '');

  return (
    <Screen edges={[]} scroll={false} contentPadding={false}>
      <Stack.Screen options={{ title: data?.plan.title ?? 'Reading plan' }} />
      {error ? (
        <ErrorState message="We couldn’t load this plan. Please try again later." />
      ) : data === undefined ? (
        <LoadingState label="Loading plan" />
      ) : data === null ? (
        <EmptyState icon="plan" title="Plan not found" message="This reading plan isn’t available." actionLabel="See all plans" onAction={() => router.replace('/plans' as Href)} />
      ) : (
        <PlanDetail item={data} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 12, paddingTop: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  daysTitle: { marginTop: 20 },
});
