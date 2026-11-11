import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { SermonForm } from '@/components/sermons/sermon-form';
import { EmptyState } from '@/components/ui';
import { db } from '@/db/client';
import { useSeriesList, useSermon } from '@/features/sermons/hooks';
import { updateSermonFromForm } from '@/features/sermons/save-sermon-form';
import { sermonToFormValues, type SermonFormOutput } from '@/features/sermons/sermon-form-schema';
import { usePickPassage } from '@/features/sermons/use-pick-passage';
import { logger } from '@/lib/logger';
import { GUTTER, useTheme } from '@/theme';

export default function EditSermonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sermonId = typeof id === 'string' ? id : '';
  const router = useRouter();
  const { colors } = useTheme();
  const sermon = useSermon(sermonId);
  const series = useSeriesList();
  const pickPassage = usePickPassage('Main passage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const save = (values: SermonFormOutput) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = updateSermonFromForm(db, sermonId, values);
      if (!updated) throw new Error('Sermon not found');
      router.back();
    } catch (error) {
      logger.error('Could not update sermon', error);
      setErrorMessage("We couldn't save your changes. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Edit sermon' }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled">
        {sermon.data ? (
          <SermonForm
            key={sermon.data.id}
            defaultValues={sermonToFormValues(sermon.data)}
            seriesOptions={series.data}
            onPickPassage={pickPassage}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            actions={[{ label: 'Save changes', icon: 'check', onSubmit: save }]}
          />
        ) : (
          <EmptyState icon="sermons" title="This sermon isn't available" message="It may have been deleted." />
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 48 },
});
