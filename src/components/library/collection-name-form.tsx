import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FaithButton, TextField } from '@/components/ui';
import { getErrorMessage } from '@/lib/logger';

export interface CollectionNameFormProps {
  initialValue?: string;
  submitLabel: string;
  /** Persist the name; throw with a user-friendly message on failure. */
  onSubmit: (title: string) => void;
  onCancel?: () => void;
}

/** Single-field form to create or rename a collection. Validation lives in the repository (Zod). */
export function CollectionNameForm({ initialValue = '', submitLabel, onSubmit, onCancel }: CollectionNameFormProps) {
  const [title, setTitle] = useState(initialValue);
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = () => {
    try {
      onSubmit(title);
      setError(undefined);
      if (!initialValue) setTitle('');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

  return (
    <View style={styles.form}>
      <TextField
        label="Collection name"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Forgiveness"
        returnKeyType="done"
        onSubmitEditing={submit}
        maxLength={80}
        error={error}
      />
      <View style={styles.buttons}>
        <FaithButton label={submitLabel} onPress={submit} isDisabled={title.trim().length === 0} />
        {onCancel ? <FaithButton label="Cancel" variant="ghost" onPress={onCancel} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
