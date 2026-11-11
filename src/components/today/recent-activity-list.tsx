import { View } from 'react-native';

import { Divider, FaithText, ListRow } from '@/components/ui';
import type { RecentActivityItem } from '@/features/today/activity';

export interface RecentActivityListProps {
  items: readonly RecentActivityItem[];
  onOpen: (item: RecentActivityItem) => void;
}

export function RecentActivityList({ items, onOpen }: RecentActivityListProps) {
  if (items.length === 0) {
    return (
      <FaithText variant="secondary">
        Your recent reading, sermons, reflections and prayers will gather here.
      </FaithText>
    );
  }

  return (
    <View>
      {items.map((item, index) => (
        <View key={item.key}>
          {index > 0 ? <Divider /> : null}
          <ListRow icon={item.icon} title={item.title} subtitle={item.subtitle} onPress={() => onOpen(item)} />
        </View>
      ))}
    </View>
  );
}
