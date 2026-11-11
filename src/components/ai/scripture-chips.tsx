import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui';
import { formatDuration } from '@/lib/time';

export interface ScriptureChipItem {
  key: string;
  referenceText: string;
  startVerseId: number;
  /** First mention in the recording, if known. */
  positionMs?: number | null;
}

export interface ScriptureChipsProps {
  items: readonly ScriptureChipItem[];
  onOpen: (item: ScriptureChipItem) => void;
}

/** Tappable Scripture references; each opens the passage in the Bible reader. */
export function ScriptureChips({ items, onOpen }: ScriptureChipsProps) {
  if (items.length === 0) return null;
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Chip
          key={item.key}
          icon="bible"
          label={item.positionMs !== null && item.positionMs !== undefined ? `${item.referenceText} · ${formatDuration(item.positionMs)}` : item.referenceText}
          accessibilityHint="Opens this passage in the Bible"
          onPress={() => onOpen(item)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
