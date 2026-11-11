import { StyleSheet, View } from 'react-native';

import { Chip, FaithButton, FaithText, IconButton } from '@/components/ui';
import type { PassageItem } from '@/features/links/connections';

export interface LinkedPassagesProps {
  passages: readonly PassageItem[];
  onAdd: () => void;
  onOpen: (item: PassageItem) => void;
  onRemove: (item: PassageItem) => void;
  addLabel?: string;
}

/** Scripture passages attached to an item: tap to read, × to detach. */
export function LinkedPassages({ passages, onAdd, onOpen, onRemove, addLabel = 'Add a passage' }: LinkedPassagesProps) {
  return (
    <View style={styles.container}>
      <FaithText variant="label" accessibilityRole="header">
        Passages
      </FaithText>
      {passages.map((item) => (
        <View key={item.key} style={styles.row}>
          <View style={styles.chip}>
            <Chip icon="bible" label={item.referenceText} onPress={() => onOpen(item)} accessibilityHint="Opens this passage in the Bible" />
          </View>
          <IconButton icon="close" size={16} accessibilityLabel={`Remove ${item.referenceText}`} onPress={() => onRemove(item)} />
        </View>
      ))}
      <FaithButton label={addLabel} icon="bible" variant="ghost" onPress={onAdd} style={styles.add} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { flexShrink: 1, alignItems: 'flex-start' },
  add: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
