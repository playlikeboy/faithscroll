import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, FaithText, TextField } from '@/components/ui';
import type { SeriesChoice } from '@/features/sermons/sermon-form-schema';

export interface SeriesOption {
  id: string;
  title: string;
}

/** Form-side series value: same as SeriesChoice but a new series title may still be blank while typing. */
export type SeriesPickerValue = { kind: 'none' } | { kind: 'existing'; id: string } | { kind: 'new'; title: string };

export interface SeriesPickerProps {
  value: SeriesPickerValue;
  options: readonly SeriesOption[];
  onChange: (value: SeriesPickerValue) => void;
  error?: string;
}

/** Pick an existing series, none, or name a new one. */
export function SeriesPicker({ value, options, onChange, error }: SeriesPickerProps) {
  const isSelected = (choice: SeriesChoice['kind'], id?: string) =>
    value.kind === choice && (choice !== 'existing' || (value.kind === 'existing' && value.id === id));

  return (
    <View style={styles.field}>
      <FaithText variant="label">Series</FaithText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="None" isSelected={isSelected('none')} onPress={() => onChange({ kind: 'none' })} />
        {options.map((option) => (
          <Chip
            key={option.id}
            label={option.title}
            isSelected={isSelected('existing', option.id)}
            onPress={() => onChange({ kind: 'existing', id: option.id })}
          />
        ))}
        <Chip
          label="New series"
          icon="add"
          isSelected={isSelected('new')}
          onPress={() => onChange({ kind: 'new', title: value.kind === 'new' ? value.title : '' })}
        />
      </ScrollView>
      {value.kind === 'new' ? (
        <TextField
          label="New series name"
          value={value.title}
          onChangeText={(title) => onChange({ kind: 'new', title })}
          placeholder="e.g. Living With Grace"
          autoCapitalize="words"
          returnKeyType="done"
          error={error}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  chips: { gap: 8, paddingVertical: 2 },
});
