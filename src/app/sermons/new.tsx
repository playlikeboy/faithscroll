import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SermonForm } from '@/components/sermons/sermon-form';
import { db } from '@/db/client';
import { useSeriesList } from '@/features/sermons/hooks';
import { createSermonFromForm } from '@/features/sermons/save-sermon-form';
import { emptySermonForm, type SermonFormOutput } from '@/features/sermons/sermon-form-schema';
import { parseIdParam } from '@/features/sermons/route-params';
import { sermonHref } from '@/features/sermons/routes';
import { usePickPassage } from '@/features/sermons/use-pick-passage';
import { logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';
import { GUTTER, useTheme } from '@/theme';

type NextStep = 'record' | 'open';

export default function NewSermonScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const series = useSeriesList();
  const pickPassage = usePickPassage('Main passage');
  const params = useLocalSearchParams<{ seriesId?: string }>();
  // `?seriesId=` (from a series page) pre-selects that series.
  const [defaultValues] = useState(() => {
    const seriesId = parseIdParam(params.seriesId);
    const empty = emptySermonForm();
    return seriesId ? { ...empty, series: { kind: 'existing' as const, id: seriesId } } : empty;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const save = (values: SermonFormOutput, next: NextStep) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const sermon = createSermonFromForm(db, values);
      track({ name: 'sermon_created' });
      if (next === 'record') {
        router.replace({ pathname: '/sermons/record/[id]', params: { id: sermon.id, then: 'detail' } });
      } else {
        router.replace(sermonHref(sermon.id));
      }
    } catch (error) {
      logger.error('Could not create sermon', error);
      setErrorMessage("We couldn't save this sermon. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'New sermon' }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled">
        <SermonForm
          defaultValues={defaultValues}
          seriesOptions={series.data}
          onPickPassage={pickPassage}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          actions={[
            {
              label: 'Start recording',
              icon: 'record',
              accessibilityHint: 'Saves the sermon and opens the recorder',
              onSubmit: (values) => save(values, 'record'),
            },
            {
              label: 'Save without recording',
              variant: 'secondary',
              accessibilityHint: 'Saves the sermon so you can take notes',
              onSubmit: (values) => save(values, 'open'),
            },
          ]}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 48 },
});
