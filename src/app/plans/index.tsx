import { router, Stack, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PlanCard } from '@/components/plans/plan-card';
import { ErrorState, FaithText, LoadingState, Screen, Section } from '@/components/ui';
import type { PlanWithProgress } from '@/features/plans/plan-views';
import { usePlanList } from '@/features/plans/use-plans';

function PlanCards({ items }: { items: PlanWithProgress[] }) {
  return (
    <View style={styles.cards}>
      {items.map((item) => (
        <PlanCard key={item.plan.id} item={item} onPress={() => router.push(`/plans/${item.plan.id}` as Href)} />
      ))}
    </View>
  );
}

export default function PlansScreen() {
  const { data, error } = usePlanList();
  const started = data?.filter((item) => item.progress) ?? [];
  const available = data?.filter((item) => !item.progress) ?? [];

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Reading plans' }} />
      <FaithText variant="secondary" style={styles.intro}>
        Gentle, self-paced plans. Read when you can — a plan simply waits for you.
      </FaithText>
      {error ? (
        <ErrorState message="We couldn’t load your reading plans. Please try again later." />
      ) : !data ? (
        <LoadingState label="Loading reading plans" />
      ) : (
        <>
          {started.length > 0 ? (
            <Section title="Your plans">
              <PlanCards items={started} />
            </Section>
          ) : null}
          {available.length > 0 ? (
            <Section title={started.length > 0 ? 'More plans' : 'Choose a plan'}>
              <PlanCards items={available} />
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingTop: 16 },
  cards: { gap: 12 },
});
