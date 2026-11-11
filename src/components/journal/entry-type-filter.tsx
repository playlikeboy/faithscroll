import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { JOURNAL_ENTRY_TYPES } from '@/db/schema';
import { JOURNAL_TYPE_LABELS, type JournalEntryType } from '@/features/journal/types';

export interface EntryTypeFilterProps {
  value: JournalEntryType | null;
  onChange: (next: JournalEntryType | null) => void;
  /** Label for the "no filter" chip; omit to hide it (e.g. when choosing a type in the editor). */
  allLabel?: string;
}

/** Horizontal row of entry-type chips, used as a filter (timeline) or a picker (editor). */
export function EntryTypeFilter({ value, onChange, allLabel }: EntryTypeFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist">
      {allLabel ? <Chip label={allLabel} isSelected={value === null} onPress={() => onChange(null)} /> : null}
      {JOURNAL_ENTRY_TYPES.map((type) => (
        <Chip
          key={type}
          label={JOURNAL_TYPE_LABELS[type]}
          isSelected={value === type}
          onPress={() => onChange(allLabel && value === type ? null : type)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
});
