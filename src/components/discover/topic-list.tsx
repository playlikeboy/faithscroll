import { StyleSheet, View } from 'react-native';

import { Card, EmptyState, FaithText, Icon } from '@/components/ui';
import type { TopicSummary } from '@/features/discover/session';
import { useTheme } from '@/theme';

export interface TopicListProps {
  topics: readonly TopicSummary[];
  onSelect: (topicId: string) => void;
}

function passageCount(count: number): string {
  return count === 1 ? '1 passage' : `${count} passages`;
}

export function TopicList({ topics, onSelect }: TopicListProps) {
  const { colors } = useTheme();

  if (topics.length === 0) {
    return (
      <EmptyState
        icon="bible"
        title="Topics are on their way"
        message="Curated passages will appear here once the Bible library is ready on this device."
      />
    );
  }

  return (
    <View style={styles.list}>
      {topics.map((topic) => (
        <Card
          key={topic.id}
          onPress={() => onSelect(topic.id)}
          accessibilityLabel={`${topic.title}. ${topic.description}. ${passageCount(topic.cardCount)}`}
          accessibilityHint="Starts a short session"
          style={styles.card}>
          <View style={styles.row}>
            <View style={styles.text}>
              <FaithText variant="title">{topic.title}</FaithText>
              <FaithText variant="secondary">{topic.description}</FaithText>
              <FaithText variant="caption">{passageCount(topic.cardCount)}</FaithText>
            </View>
            <Icon name="forward" size={14} color={colors.textTertiary} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { paddingVertical: 18, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 4 },
});
