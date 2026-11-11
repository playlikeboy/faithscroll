import { Stack, useLocalSearchParams } from 'expo-router';

import { DeepStudyScreen } from '@/components/ai/study/deep-study-screen';
import { EmptyState, Screen } from '@/components/ui';
import { parsePassageParams } from '@/features/study-ai/passage';

export default function DeepStudyRoute() {
  const params = useLocalSearchParams<{ start?: string; end?: string }>();
  const range = parsePassageParams(params);

  return (
    <>
      <Stack.Screen options={{ title: 'Deep Study' }} />
      {range ? (
        <DeepStudyScreen start={range.start} end={range.end} />
      ) : (
        <Screen edges={[]}>
          <EmptyState icon="study" title="Choose a passage" message="Open Deep Study from a verse in the Bible reader." />
        </Screen>
      )}
    </>
  );
}
