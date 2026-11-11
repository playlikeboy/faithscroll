import { StyleSheet, View } from 'react-native';

import { Divider, FaithButton, FaithText, IconButton, ListRow } from '@/components/ui';
import type { ConnectedItem } from '@/features/links/connections';
import { LINK_TYPE_ICONS, LINK_TYPE_LABELS } from '@/features/links/resolve';

export interface LinkedItemsListProps {
  items: readonly ConnectedItem[];
  onOpen: (item: ConnectedItem) => void;
  onRemove: (item: ConnectedItem) => void;
  onAdd?: () => void;
  title?: string;
  addLabel?: string;
  emptyText?: string;
}

/** Sermons, prayers, entries and actions connected to an item (links work in both directions). */
export function LinkedItemsList({
  items,
  onOpen,
  onRemove,
  onAdd,
  title = 'Connected',
  addLabel = 'Link a sermon, prayer or entry',
  emptyText,
}: LinkedItemsListProps) {
  return (
    <View style={styles.container}>
      <FaithText variant="label" accessibilityRole="header">
        {title}
      </FaithText>
      {items.length === 0 && emptyText ? <FaithText variant="secondary">{emptyText}</FaithText> : null}
      {items.map((item, index) => (
        <View key={item.key}>
          {index > 0 ? <Divider /> : null}
          <ListRow
            icon={LINK_TYPE_ICONS[item.type]}
            title={item.title}
            subtitle={[LINK_TYPE_LABELS[item.type], item.subtitle].filter(Boolean).join(' · ')}
            onPress={() => onOpen(item)}
            showChevron={false}
            trailing={<IconButton icon="close" size={16} accessibilityLabel={`Unlink ${item.title}`} onPress={() => onRemove(item)} />}
          />
        </View>
      ))}
      {onAdd ? <FaithButton label={addLabel} icon="related" variant="ghost" onPress={onAdd} style={styles.add} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  add: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
