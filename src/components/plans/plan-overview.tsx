import { StyleSheet, View } from 'react-native';

import { Card, FaithButton, FaithText } from '@/components/ui';
import { getPlanDay } from '@/features/plans/catalog';
import { formatPlanReading } from '@/features/plans/format';
import { describePlanStatus, type PlanWithProgress } from '@/features/plans/plan-views';
import type { PlanReading } from '@/features/plans/types';

import { PlanProgressBar } from './plan-progress-bar';

export interface PlanOverviewProps {
  item: PlanWithProgress;
  isBusy: boolean;
  onStart: () => void;
  onResume: () => void;
  onOpenReading: (reading: PlanReading) => void;
  onCompleteDay: (day: number) => void;
}

function NotStarted({ item, isBusy, onStart }: PlanOverviewProps) {
  return (
    <Card>
      <View style={styles.body}>
        <FaithText variant="secondary">
          Read at your own pace. Each day waits for you — there’s no schedule to keep up with.
        </FaithText>
        <FaithButton label="Start plan" icon="plan" isLoading={isBusy} onPress={onStart} accessibilityHint={`Starts ${item.plan.title}`} />
      </View>
    </Card>
  );
}

export function PlanOverview(props: PlanOverviewProps) {
  const { item, isBusy, onResume, onOpenReading, onCompleteDay } = props;
  const { progress, summary, plan } = item;
  if (!progress) return <NotStarted {...props} />;

  const status = describePlanStatus(item);
  const currentDay = summary.currentDay ? getPlanDay(plan, summary.currentDay) : undefined;

  return (
    <Card>
      <View style={styles.body}>
        <FaithText variant="label">{status}</FaithText>
        <PlanProgressBar completed={summary.completedCount} total={summary.totalDays} />
        {summary.isComplete ? (
          <FaithText variant="bodySerif">You’ve read every day of this plan. May what you read stay with you.</FaithText>
        ) : null}
        {progress.status === 'paused' ? (
          <>
            <FaithText variant="secondary">This plan is paused. Pick it up again whenever you’re ready.</FaithText>
            <FaithButton label="Resume plan" isLoading={isBusy} onPress={onResume} />
          </>
        ) : null}
        {progress.status === 'active' && currentDay ? (
          <>
            {currentDay.theme ? <FaithText variant="title">{currentDay.theme}</FaithText> : null}
            <View style={styles.readings}>
              {currentDay.readings.map((reading) => {
                const label = formatPlanReading(reading);
                return (
                  <FaithButton
                    key={label}
                    label={`Read ${label}`}
                    icon="bible"
                    variant="secondary"
                    onPress={() => onOpenReading(reading)}
                  />
                );
              })}
            </View>
            <FaithButton
              label={`Mark Day ${currentDay.day} as read`}
              icon="check"
              isDisabled={isBusy}
              onPress={() => onCompleteDay(currentDay.day)}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  readings: { gap: 8 },
});
