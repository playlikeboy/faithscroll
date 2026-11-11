import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton, ListRow, Screen, Section } from '@/components/ui';
import { useScriptureTextStyle } from '@/features/settings/scripture-size';
import { formatLongDate, greetingFor } from '@/features/today/dates';
import { FIRST_CHAPTER, todayRoutes } from '@/features/today/routes';
import { shareVerse } from '@/features/today/share';
import { useDailyIntention } from '@/features/today/use-daily-intention';
import { useDailyReflection } from '@/features/today/use-daily-reflection';
import { useNow } from '@/features/today/use-now';
import { useSavedRanges } from '@/features/today/use-saved-ranges';
import { useContinueReading, useRecentActivity } from '@/features/today/use-today-activity';
import { useVerseOfTheDay } from '@/features/today/use-verse-of-the-day';

import { ContinueReadingCard } from './continue-reading-card';
import { DailyIntention } from './daily-intention';
import { DailyReflectionCard } from './daily-reflection-card';
import { QuickActions, type QuickActionKey } from './quick-actions';
import { RecentActivityList } from './recent-activity-list';
import { VerseOfTheDayCard } from './verse-of-the-day-card';

/** Today tab: a warm, finite overview. Works fully offline and with an empty library. */
export function TodayScreen() {
  const router = useRouter();
  const now = useNow();
  const verse = useVerseOfTheDay(now);
  const saved = useSavedRanges([verse.range]);
  const scriptureStyle = useScriptureTextStyle();
  const progress = useContinueReading();
  const recent = useRecentActivity(now);
  const intention = useDailyIntention(now);
  const reflection = useDailyReflection(now);

  const { start } = verse.range;
  const openQuickAction = (key: QuickActionKey) => {
    if (key === 'read') router.navigate(todayRoutes.bible);
    if (key === 'sermon') router.push(todayRoutes.newSermon);
    if (key === 'journal') router.push(todayRoutes.newJournalEntry);
    if (key === 'prayer') router.push(todayRoutes.newPrayer);
  };

  return (
    <Screen
      edges={['top']}
      eyebrow={formatLongDate(now)}
      title={greetingFor(now)}
      headerRight={
        <IconButton icon="settings" accessibilityLabel="Settings" onPress={() => router.push(todayRoutes.settings)} />
      }>
      <View style={styles.stack}>
        <DailyIntention intention={intention.intention} onSave={intention.save} onClear={intention.clear} />

        <VerseOfTheDayCard
          reference={verse.reference}
          translation={verse.translation}
          text={verse.text}
          isLoading={verse.isLoading}
          isSaved={saved.isSaved(verse.range)}
          saveError={saved.error}
          scriptureStyle={scriptureStyle}
          onToggleSave={() => saved.toggle(verse.range)}
          onShare={() => void shareVerse(verse)}
          onStudy={() => router.push(todayRoutes.study(verse.startVerseId, verse.endVerseId))}
          onRead={() => router.push(todayRoutes.readChapter(start.bookId, start.chapter, start.verse))}
        />

        <ContinueReadingCard
          progress={progress}
          onResume={() =>
            progress && router.push(todayRoutes.readChapter(progress.bookId, progress.chapter, progress.verse))
          }
          onStart={() => router.push(todayRoutes.readChapter(FIRST_CHAPTER.bookId, FIRST_CHAPTER.chapter))}
        />
      </View>

      <Section title="Reflect">
        <DailyReflectionCard
          prompt={reflection.prompt}
          text={reflection.text}
          onChangeText={reflection.setText}
          passageLabel={reflection.passage?.label ?? null}
          onAttachPassage={reflection.attachPassage}
          onRemovePassage={reflection.removePassage}
          canSave={reflection.canSave}
          onSave={reflection.save}
          isSaved={reflection.savedEntryId !== null}
          onOpenEntry={() => reflection.savedEntryId && router.push(todayRoutes.journalEntry(reflection.savedEntryId))}
          error={reflection.error}
        />
      </Section>

      <Section title="Quick actions">
        <QuickActions onAction={openQuickAction} />
      </Section>

      <Section title="Recently">
        <RecentActivityList items={recent} onOpen={(item) => router.push(item.href)} />
      </Section>

      <Section title="Discover">
        <ListRow
          icon="search"
          title="Explore Scripture by topic"
          subtitle="A short session on hope, peace, forgiveness and more"
          onPress={() => router.push(todayRoutes.discover)}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
});
