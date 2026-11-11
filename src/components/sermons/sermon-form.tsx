import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, TextField, type ButtonVariant, type IconName } from '@/components/ui';
import { defaultSermonTitle } from '@/features/sermons/format';
import { sermonFormSchema, type SermonFormOutput, type SermonFormValues } from '@/features/sermons/sermon-form-schema';
import type { PassageValue } from '@/features/sermons/types';

import { DateField } from './date-field';
import { PassageField } from './passage-field';
import { SeriesPicker, type SeriesOption } from './series-picker';

export interface SermonFormAction {
  label: string;
  icon?: IconName;
  variant?: ButtonVariant;
  accessibilityHint?: string;
  onSubmit: (values: SermonFormOutput) => void | Promise<void>;
}

export interface SermonFormProps {
  defaultValues: SermonFormValues;
  seriesOptions: readonly SeriesOption[];
  /** Opens the passage picker; resolves with the chosen passage or null when cancelled. */
  onPickPassage: (current: PassageValue | null) => Promise<PassageValue | null>;
  actions: readonly SermonFormAction[];
  isSubmitting?: boolean;
  /** Shown above the actions when saving failed. */
  errorMessage?: string | null;
}

/** Minimal-friction sermon metadata form. Only the title matters, and it has a dated default. */
export function SermonForm({ defaultValues, seriesOptions, onPickPassage, actions, isSubmitting = false, errorMessage }: SermonFormProps) {
  const { control, handleSubmit, formState } = useForm<SermonFormValues, unknown, SermonFormOutput>({
    resolver: zodResolver(sermonFormSchema),
    defaultValues,
  });
  const sermonDate = useWatch({ control, name: 'sermonDate' });
  const errors = formState.errors;
  // The discriminated union's error shape only has `title` for the "new series" branch.
  const seriesError = (errors.series as { title?: { message?: string } } | undefined)?.title?.message;

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label="Title"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={defaultSermonTitle(sermonDate)}
            helper={`Leave blank to use “${defaultSermonTitle(sermonDate)}”.`}
            error={errors.title?.message}
            autoCapitalize="words"
            returnKeyType="next"
          />
        )}
      />
      <Controller
        control={control}
        name="speaker"
        render={({ field }) => (
          <TextField
            label="Speaker"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="Optional"
            error={errors.speaker?.message}
            autoCapitalize="words"
            textContentType="name"
          />
        )}
      />
      <Controller
        control={control}
        name="church"
        render={({ field }) => (
          <TextField
            label="Church"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder="Optional"
            error={errors.church?.message}
            autoCapitalize="words"
          />
        )}
      />
      <Controller
        control={control}
        name="series"
        render={({ field }) => <SeriesPicker value={field.value} options={seriesOptions} onChange={field.onChange} error={seriesError} />}
      />
      <Controller
        control={control}
        name="sermonDate"
        render={({ field }) => <DateField label="Date" value={field.value} onChange={field.onChange} error={errors.sermonDate?.message} />}
      />
      <Controller
        control={control}
        name="mainPassage"
        render={({ field }) => (
          <PassageField
            label="Main passage"
            value={field.value}
            onPick={() => {
              void onPickPassage(field.value).then((picked) => {
                if (picked) field.onChange(picked);
              });
            }}
            onClear={() => field.onChange(null)}
          />
        )}
      />

      <FaithText variant="caption">Everything except the title is optional — you can add details later.</FaithText>

      {errorMessage ? (
        <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {errorMessage}
        </FaithText>
      ) : null}

      <View style={styles.actions}>
        {actions.map((action) => (
          <FaithButton
            key={action.label}
            label={action.label}
            icon={action.icon}
            variant={action.variant ?? 'primary'}
            accessibilityHint={action.accessibilityHint}
            isDisabled={isSubmitting}
            onPress={handleSubmit(action.onSubmit)}
            fullWidth
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  actions: { gap: 10, marginTop: 4 },
});
