import { StyleSheet, View } from 'react-native';

import { Divider, ListRow } from '@/components/ui';
import type { ActionItemRow } from '@/features/sermons/types';

export interface SermonActionItemsProps {
  items: readonly ActionItemRow[];
  onReflect: (actionItemId: string) => void;
}

/** "Live it out" action items that came from this sermon or its recap. */
export function SermonActionItems({ items, onReflect }: SermonActionItemsProps) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <Divider /> : null}
          <ListRow
            icon={item.completedAt ? 'check' : 'action'}
            title={item.title}
            subtitle={item.completedAt ? 'Done' : 'Reflect on this in your journal'}
            onPress={() => onReflect(item.id)}
            accessibilityHint="Starts a journal reflection about this action"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: 0 } });
