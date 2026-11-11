import { StyleSheet, View } from 'react-native';

import { Chip, FaithButton, FaithText, IconButton } from '@/components/ui';
import type { PassageValue } from '@/features/sermons/types';

export interface PassageFieldProps {
  label: string;
  value: PassageValue | null;
  onPick: () => void;
  onClear: () => void;
}

/** Shows the chosen Bible passage as a chip, with change/remove controls. */
export function PassageField({ label, value, onPick, onClear }: PassageFieldProps) {
  return (
    <View style={styles.field}>
      <FaithText variant="label">{label}</FaithText>
      {value ? (
        <View style={styles.row}>
          <Chip label={value.text} icon="bible" onPress={onPick} accessibilityHint="Choose a different passage" />
          <IconButton icon="close" accessibilityLabel={`Remove ${label.toLowerCase()}`} onPress={onClear} size={18} />
        </View>
      ) : (
        <FaithButton label="Add passage" icon="bible" variant="secondary" onPress={onPick} style={styles.add} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  add: { alignSelf: 'flex-start' },
});
