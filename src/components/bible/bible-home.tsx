import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, Divider, FaithButton, FaithText, IconButton, ListRow, Screen, Section } from '@/components/ui';
import { getBook } from '@/features/bible/books';
import { useReadingProgress, useRecentChapters } from '@/features/bible/hooks/use-reading';
import { chapterTitle, formatReadAt } from '@/features/bible/reader/format';
import { bibleRoutes } from '@/features/bible/reader/routes';
import { DEFAULT_TRANSLATION } from '@/features/bible/repository';

import { ReadingProgress } from './reading-progress';

/** Gospel of John: a gentle first step for someone new to the Bible. */
const FIRST_READ = { bookId: 43, chapter: 1 } as const;
const RECENT_LIMIT = 5;

function ContinueReadingCard() {
  const { progress, isLoading } = useReadingProgress();
  if (isLoading) return null;

  if (!progress || !getBook(progress.bookId)) {
    return (
      <Card>
        <View style={styles.cardBody}>
          <FaithText variant="label">Start reading</FaithText>
          <FaithText variant="title">Begin with the Gospel of John</FaithText>
          <FaithText variant="secondary">A good first book: the life and words of Jesus.</FaithText>
          <FaithButton
            label="Read John 1"
            icon="bible"
            onPress={() => router.push(bibleRoutes.reader(FIRST_READ.bookId, FIRST_READ.chapter))}
          />
        </View>
      </Card>
    );
  }

  const title = chapterTitle(progress.bookId, progress.chapter);
  return (
    <Card
      onPress={() => router.push(bibleRoutes.reader(progress.bookId, progress.chapter))}
      accessibilityLabel={`Continue reading ${title}`}
      accessibilityHint="Opens where you left off">
      <View style={styles.cardBody}>
        <FaithText variant="label">Continue reading</FaithText>
        <View style={styles.continueRow}>
          <FaithText variant="title" style={styles.flex}>
            {title}
          </FaithText>
          <FaithText variant="secondary" weight="600" color="primaryText">
            Resume
          </FaithText>
        </View>
        <ReadingProgress bookId={progress.bookId} chapter={progress.chapter} />
      </View>
    </Card>
  );
}

function RecentChapters() {
  const { chapters } = useRecentChapters(RECENT_LIMIT);
  if (chapters.length === 0) return null;
  return (
    <Section title="Recently read">
      <View>
        {chapters.map((item) => (
          <ListRow
            key={`${item.bookId}:${item.chapter}`}
            icon="bible"
            title={chapterTitle(item.bookId, item.chapter)}
            subtitle={formatReadAt(item.lastReadAt)}
            onPress={() => router.push(bibleRoutes.reader(item.bookId, item.chapter))}
          />
        ))}
      </View>
    </Section>
  );
}

/** Bible tab: continue reading, browse, discover, search and recent chapters. */
export function BibleHome() {
  return (
    <Screen
      title="Bible"
      eyebrow={DEFAULT_TRANSLATION.name}
      headerRight={
        <IconButton icon="search" accessibilityLabel="Search the Bible" onPress={() => router.push(bibleRoutes.search())} />
      }>
      <ContinueReadingCard />
      <Section title="Read">
        <Card>
          <ListRow
            icon="list"
            title="Books"
            subtitle="Old and New Testament"
            onPress={() => router.push(bibleRoutes.books())}
          />
          <Divider />
          <ListRow
            icon="heart"
            title="Discover"
            subtitle="Short readings on faith, hope, peace and more"
            onPress={() => router.push(bibleRoutes.discover())}
          />
          <Divider />
          <ListRow
            icon="search"
            title="Search"
            subtitle="Words, phrases, references and topics"
            onPress={() => router.push(bibleRoutes.search())}
          />
        </Card>
      </Section>
      <RecentChapters />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardBody: { gap: 10 },
  continueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  flex: { flex: 1 },
});
