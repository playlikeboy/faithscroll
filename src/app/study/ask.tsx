import { Stack, useLocalSearchParams } from 'expo-router';

import { AskScreen } from '@/components/ai/study/ask-screen';
import { EmptyState, Screen } from '@/components/ui';
import { parsePassageParams } from '@/features/study-ai/passage';

export default function AskAboutPassageRoute() {
  const params = useLocalSearchParams<{ start?: string; end?: string }>();
  const range = parsePassageParams(params);

  return (
    <>
      <Stack.Screen options={{ title: 'Ask about this passage' }} />
      {range ? (
        <AskScreen start={range.start} end={range.end} />
      ) : (
        <Screen edges={[]}>
          <EmptyState icon="study" title="Choose a passage" message="Open the study assistant from a verse in the Bible reader." />
        </Screen>
      )}
    </>
  );
}
