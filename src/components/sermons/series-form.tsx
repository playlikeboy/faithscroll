import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { FaithButton, TextField } from '@/components/ui';
import { seriesFormSchema, type SeriesFormOutput, type SeriesFormValues } from '@/features/sermons/series-form-schema';

export interface SeriesFormProps {
  defaultValues: SeriesFormValues;
  submitLabel: string;
  onSubmit: (values: SeriesFormOutput) => void;
  onCancel?: () => void;
}

const FIELDS = [
  { name: 'title', label: 'Series name', placeholder: 'e.g. Living With Grace', multiline: false },
  { name: 'speaker', label: 'Speaker', placeholder: 'Optional', multiline: false },
  { name: 'church', label: 'Church', placeholder: 'Optional', multiline: false },
  { name: 'description', label: 'Description', placeholder: 'What is this series about? (optional)', multiline: true },
] as const;

/** Series details form (only the name is required). */
export function SeriesForm({ defaultValues, submitLabel, onSubmit, onCancel }: SeriesFormProps) {
  const { control, handleSubmit, formState } = useForm<SeriesFormValues, unknown, SeriesFormOutput>({
    resolver: zodResolver(seriesFormSchema),
    defaultValues,
  });

  return (
    <View style={styles.form}>
      {FIELDS.map((field) => (
        <Controller
          key={field.name}
          control={control}
          name={field.name}
          render={({ field: input }) => (
            <TextField
              label={field.label}
              value={input.value}
              onChangeText={input.onChange}
              onBlur={input.onBlur}
              placeholder={field.placeholder}
              multiline={field.multiline}
              autoCapitalize={field.multiline ? 'sentences' : 'words'}
              error={formState.errors[field.name]?.message}
            />
          )}
        />
      ))}
      <View style={styles.actions}>
        <FaithButton label={submitLabel} icon="check" onPress={handleSubmit(onSubmit)} fullWidth />
        {onCancel ? <FaithButton label="Cancel" variant="ghost" onPress={onCancel} fullWidth /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  actions: { gap: 8 },
});
