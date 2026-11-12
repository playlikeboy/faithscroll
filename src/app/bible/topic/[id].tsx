import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { Chip, Divider, EmptyState, ErrorState, FaithText, LoadingState } from '@/components/ui';
import { describeVerseRange } from '@/features/links/reference-text';
import { passageHref } from '@/features/links/routes';
import { useTopic } from '@/features/bible/study-data/hooks';
import { TOPICS_ATTRIBUTION } from '@/features/bible/study-data/repository';
import { studyRoutes } from '@/features/bible/study-data/routes';
import type { TopicDetail, TopicPassage } from '@/features/bible/study-data/types';
import { GUTTER, MIN_TOUCH_TARGET } from '@/theme';

interface PassageSection {
  key: string;
  title: string;
  data: TopicPassage[];
}

function toSections(topic: TopicDetail): PassageSection[] {
  const popular = topic.popular.length > 0 ? [{ key: 'popular', title: 'Most helpful', data: topic.popular }] : [];
  const nave = topic.sections.map((section, index) => ({
    key: `nave-${index}`,
    title: section.label ?? 'References',
    data: section.passages,
  }));
  return [...popular, ...nave];
}

function PassageRow({ passage }: { passage: TopicPassage }) {
  const reference = describeVerseRange(passage.startVerseId, passage.endVerseId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${reference}. ${passage.text}`}
      accessibilityHint="Opens this passage in the reader"
      onPress={() => router.push(passageHref(passage.startVerseId))}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <FaithText variant="heading">{reference}</FaithText>
      {passage.text ? (
        <FaithText variant="bodySerif" color="scripture" numberOfLines={4}>
          {passage.text}
        </FaithText>
      ) : null}
    </Pressable>
  );
}

function SeeAlso({ topic }: { topic: TopicDetail }) {
  if (topic.seeAlso.length === 0) return null;
  return (
    <View style={styles.seeAlso}>
      <FaithText variant="label">See also</FaithText>
      <View style={styles.chips}>
        {topic.seeAlso.map((link) => (
          <Chip key={link.id} label={link.name} accessibilityHint="Opens this topic" onPress={() => router.push(studyRoutes.topic(link.id))} />
        ))}
      </View>
    </View>
  );
}

/** One topic from the bundled topical index, with its passages (WEB text). */
export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const topicId = Number.parseInt(String(id ?? ''), 10);
  const { data: topic, isPending, isError, refetch } = useTopic(topicId);

  if (!Number.isInteger(topicId) || topicId <= 0 || (!isPending && !isError && !topic)) {
    return <EmptyState icon="search" title="Topic not found" message="This topic isn’t in the bundled topical index." />;
  }
  if (isError) return <ErrorState message="This topic couldn’t be opened. Please try again." onRetry={() => void refetch()} />;
  if (isPending || !topic) return <LoadingState />;

  return (
    <>
      <Stack.Screen options={{ title: topic.name }} />
      <SectionList<TopicPassage, PassageSection>
        sections={toSections(topic)}
        keyExtractor={(item, index) => `${item.startVerseId}-${item.endVerseId}-${index}`}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <View style={styles.header}>
            <FaithText variant="display" accessibilityRole="header">
              {topic.name}
            </FaithText>
            <FaithText variant="secondary">
              {topic.verseCount === 1 ? '1 passage' : `${topic.verseCount} passages`} · World English Bible
            </FaithText>
            <SeeAlso topic={topic} />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <FaithText variant="title" accessibilityRole="header" style={styles.sectionTitle}>
            {section.title}
          </FaithText>
        )}
        renderItem={({ item }) => <PassageRow passage={item} />}
        ListFooterComponent={
          <FaithText variant="caption" style={styles.footer}>
            {TOPICS_ATTRIBUTION}
          </FaithText>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 8, paddingTop: 12 },
  seeAlso: { gap: 8, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { marginTop: 24, marginBottom: 4 },
  row: { paddingVertical: 12, gap: 4, minHeight: MIN_TOUCH_TARGET },
  pressed: { opacity: 0.6 },
  footer: { paddingTop: 24 },
});
