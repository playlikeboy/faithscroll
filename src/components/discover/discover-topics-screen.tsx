import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FaithText, Screen } from '@/components/ui';
import { listTopics } from '@/features/discover/session';
import { todayRoutes } from '@/features/today/routes';

import { TopicList } from './topic-list';

export function DiscoverTopicsScreen() {
  const router = useRouter();
  const topics = listTopics();

  return (
    <Screen edges={[]}>
      <FaithText variant="bodySerif" color="textSecondary" style={styles.intro}>
        Short, unhurried sessions of Scripture on a single theme. Each one ends with a path into the full chapter.
      </FaithText>
      <TopicList topics={topics} onSelect={(topicId) => router.push(todayRoutes.discoverTopic(topicId))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: 12, marginBottom: 20 },
});
