import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, FaithText, LoadingState, Screen } from '@/components/ui';
import type { SessionCard } from '@/features/discover/session';
import { useDiscoverSession } from '@/features/discover/use-discover-session';
import { useScriptureTextStyle } from '@/features/settings/scripture-size';
import { chapterLabel } from '@/features/today/passage';
import { todayRoutes } from '@/features/today/routes';
import { useSavedRanges } from '@/features/today/use-saved-ranges';
import { GUTTER } from '@/theme';

import { DiscoverCardView } from './discover-card';
import { SessionEnd } from './session-end';

export interface DiscoverSessionScreenProps {
  topicId: string | undefined;
}

/** A finite topic session: a handful of cards, then a clear end. No infinite scroll, no autoplay. */
export function DiscoverSessionScreen({ topicId }: DiscoverSessionScreenProps) {
  const router = useRouter();
  const session = useDiscoverSession(topicId);
  const saved = useSavedRanges(session.cards.map((card) => card.range));
  const scriptureStyle = useScriptureTextStyle();
  const chooseTopic = () => router.replace(todayRoutes.discover);

  if (!session.topic) {
    return (
      <Screen edges={[]}>
        <EmptyState
          icon="bible"
          title="This topic isn't available"
          message="It may have moved. Choose another topic to continue."
          actionLabel="Choose another topic"
          onAction={chooseTopic}
        />
      </Screen>
    );
  }
  if (session.isLoading) {
    return (
      <Screen edges={[]}>
        <LoadingState label="Preparing your session" />
      </Screen>
    );
  }
  if (session.isError) {
    return (
      <Screen edges={[]}>
        <ErrorState message="We couldn't open these passages. Please try again." onRetry={session.retry} />
      </Screen>
    );
  }

  const topic = session.topic;
  const lastCard = session.cards.at(-1);
  const total = session.cards.length;

  const renderItem = ({ item, index }: { item: SessionCard; index: number }) => (
    <DiscoverCardView
      card={item}
      topicTitle={topic.title}
      position={index + 1}
      total={total}
      isSaved={saved.isSaved(item.range)}
      scriptureStyle={scriptureStyle}
      onToggleSave={() => saved.toggle(item.range)}
      onOpenStudy={() => router.push(todayRoutes.study(item.startVerseId, item.endVerseId))}
    />
  );

  return (
    <Screen edges={[]} scroll={false} contentPadding={false}>
      <FlatList
        data={session.cards}
        keyExtractor={(card) => card.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.header}>
            <FaithText variant="bodySerif" color="textSecondary">
              {topic.description}
            </FaithText>
            {saved.error ? (
              <FaithText variant="caption" color="danger" accessibilityLiveRegion="polite">
                {saved.error}
              </FaithText>
            ) : null}
          </View>
        }
        ListFooterComponent={
          <SessionEnd
            chapterLabel={lastCard ? chapterLabel(lastCard.range) : null}
            onReadChapter={() =>
              lastCard &&
              router.push(
                todayRoutes.readChapter(lastCard.range.start.bookId, lastCard.range.start.chapter, lastCard.range.start.verse),
              )
            }
            onChooseTopic={chooseTopic}
          />
        }
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { paddingTop: 12, paddingBottom: 20, gap: 8 },
  separator: { height: 20 },
});
