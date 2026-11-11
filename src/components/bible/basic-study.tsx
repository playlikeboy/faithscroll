import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, FaithButton, FaithText, Icon, ListRow, LoadingState } from '@/components/ui';
import type { HighlightColorValue } from '@/features/bible/annotations/highlights';
import { rangeLabel } from '@/features/bible/reader/format';
import { bibleRoutes } from '@/features/bible/reader/routes';
import { DEFAULT_TRANSLATION } from '@/features/bible/repository';
import type { Verse, VerseRange } from '@/features/bible/types';
import { fromVerseId, idsToRange, toVerseId } from '@/features/bible/verse-id';
import { useBasicStudy } from '@/features/study/use-basic-study';
import { GUTTER, useTheme } from '@/theme';

import { ScriptureCard, ScriptureText } from './scripture-card';
import { ScriptureReferenceChip } from './scripture-reference-chip';
import { StudySection } from './study-section';
import { HIGHLIGHT_NAMES } from './verse-label';

export interface BasicStudyProps {
  startVerseId: number;
  endVerseId: number;
  range: VerseRange;
}

const openInReader = (verse: { bookId: number; chapter: number; verse: number }) =>
  router.push(bibleRoutes.reader(verse.bookId, verse.chapter, verse.verse));

function ContextCard({ label, verses }: { label: string; verses: readonly Verse[] }) {
  if (verses.length === 0) return null;
  const first = verses[0];
  return (
    <ScriptureCard
      reference={`${label} · ${rangeLabel(idsToRange(first.id, verses[verses.length - 1].id))}`}
      verses={verses}
      fontSize={17}
      onPress={() => openInReader(first)}
      accessibilityHint="Opens this passage in the reader"
    />
  );
}

function highlightSummary(highlights: ReadonlyMap<number, HighlightColorValue>): string[] {
  return [...highlights.entries()].map(
    ([verseId, color]) => `Verse ${fromVerseId(verseId).verse} highlighted ${HIGHLIGHT_NAMES[color].toLowerCase()}`,
  );
}

function DeeperStudyLinks({ startVerseId, endVerseId }: { startVerseId: number; endVerseId: number }) {
  return (
    <Card tone="ai">
      <View style={styles.deeper}>
        <View style={styles.aiLabel}>
          <Icon name="sparkles" size={14} />
          <FaithText variant="label">Uses AI · separate from Scripture</FaithText>
        </View>
        <FaithText variant="secondary">
          AI study explains context and cites its sources. It can be wrong, so test it against Scripture and talk with
          people you trust.
        </FaithText>
        <FaithButton
          label="Ask about this passage"
          icon="sparkles"
          variant="secondary"
          onPress={() => router.push(bibleRoutes.askAboutPassage(startVerseId, endVerseId))}
        />
        <FaithButton
          label="Deep Study"
          icon="study"
          variant="secondary"
          onPress={() => router.push(bibleRoutes.deepStudy(startVerseId, endVerseId))}
        />
      </View>
    </Card>
  );
}

/** Basic study: Scripture, surrounding context, cross references, the user's notes and reflection questions. */
export function BasicStudy({ startVerseId, endVerseId, range }: BasicStudyProps) {
  const { colors } = useTheme();
  const { passage, context, crossReferences, annotations, questions } = useBasicStudy(startVerseId, endVerseId, range);
  const reference = rangeLabel(range);
  const highlights = highlightSummary(annotations.highlights);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Study' }} />
      <View style={styles.header}>
        <FaithText variant="label">Basic study</FaithText>
        <FaithText variant="display" accessibilityRole="header">
          {reference}
        </FaithText>
        <FaithText variant="caption">{DEFAULT_TRANSLATION.name}</FaithText>
      </View>

      <Card tone="muted">
        <View style={styles.notice}>
          <Icon name="info" size={16} color={colors.textSecondary} />
          <FaithText variant="secondary" style={styles.flex}>
            Basic study shows Scripture and cross references only. Nothing on this page is AI-generated.
          </FaithText>
        </View>
      </Card>

      {passage.isPending ? <LoadingState label={`Loading ${reference}`} /> : null}
      {passage.isError ? (
        <FaithText variant="secondary" color="danger">
          We couldn’t load the text of this passage. Please try again later.
        </FaithText>
      ) : null}
      {passage.data && passage.data.length > 0 ? <ScriptureText verses={passage.data} fontSize={21} /> : null}

      <StudySection title="Context">
        {context.before.length === 0 && context.after.length === 0 ? (
          <FaithText variant="secondary">Read the whole chapter to see what comes before and after.</FaithText>
        ) : null}
        <ContextCard label="Before" verses={context.before} />
        <ContextCard label="After" verses={context.after} />
        <FaithButton
          label="Read the whole chapter"
          icon="bible"
          variant="ghost"
          onPress={() => openInReader(range.start)}
        />
      </StudySection>

      <StudySection title="Cross references">
        {crossReferences.isPending ? <LoadingState label="Loading cross references" /> : null}
        {crossReferences.data && crossReferences.data.length === 0 ? (
          <FaithText variant="secondary">No cross references are listed for this passage yet.</FaithText>
        ) : null}
        {crossReferences.isError ? (
          <FaithText variant="secondary">Cross references aren’t available right now.</FaithText>
        ) : null}
        <View style={styles.chips}>
          {(crossReferences.data ?? []).map((related) => (
            <ScriptureReferenceChip
              key={`${toVerseId(related.start)}-${toVerseId(related.end)}`}
              range={related}
              onPress={(target) => openInReader(target.start)}
            />
          ))}
        </View>
      </StudySection>

      <StudySection title="Your notes & highlights">
        {annotations.notes.length === 0 && highlights.length === 0 ? (
          <FaithText variant="secondary">You haven’t added notes or highlights to this passage yet.</FaithText>
        ) : null}
        {highlights.map((line) => (
          <FaithText key={line} variant="secondary">
            {line}
          </FaithText>
        ))}
        {annotations.notes.map((note) => (
          <ListRow
            key={note.id}
            icon="note"
            title={note.content.trim() ? note.content.trim().split('\n')[0] : 'Untitled note'}
            subtitle={rangeLabel(idsToRange(note.startVerseId, note.endVerseId))}
            onPress={() => router.push(bibleRoutes.note(note.id))}
          />
        ))}
      </StudySection>

      <StudySection title="Reflect">
        {questions.map((question, index) => (
          <FaithText key={question} variant="bodySerif">{`${index + 1}. ${question}`}</FaithText>
        ))}
        <FaithButton
          label="Start a reflection"
          icon="reflect"
          variant="secondary"
          onPress={() => router.push(bibleRoutes.reflection(startVerseId, endVerseId))}
        />
      </StudySection>

      <StudySection title="Go deeper">
        <DeeperStudyLinks startVerseId={startVerseId} endVerseId={endVerseId} />
      </StudySection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 64, gap: 16 },
  header: { paddingTop: 16, gap: 4 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deeper: { gap: 12 },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
