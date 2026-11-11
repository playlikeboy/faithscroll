import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Divider, FaithText, ListRow, LoadingState } from '@/components/ui';
import { useCrossReferences, useVerses } from '@/features/bible/hooks/use-bible-text';
import { useRangeAnnotations } from '@/features/bible/hooks/use-range-annotations';
import { rangeLabel } from '@/features/bible/reader/format';
import { sharedHighlightColor } from '@/features/bible/reader/markers';
import { leaveSheetTo } from '@/features/bible/reader/navigation';
import { bibleRoutes } from '@/features/bible/reader/routes';
import { contiguousVerseIds } from '@/features/bible/reader/selection';
import { useVerseActions } from '@/features/bible/reader/use-verse-actions';
import { DEFAULT_TRANSLATION } from '@/features/bible/repository';
import type { VerseRange } from '@/features/bible/types';
import { idsToRange, toVerseId } from '@/features/bible/verse-id';
import { GUTTER, useTheme } from '@/theme';

import { HighlightSwatches } from './highlight-swatches';
import { passagePlainText, ScriptureCard } from './scripture-card';
import { ScriptureReferenceChip } from './scripture-reference-chip';

export interface VerseActionSheetProps {
  startVerseId: number;
  endVerseId: number;
  range: VerseRange;
}

const RELATED_LIMIT = 8;

function RelatedVerses({ verseId }: { verseId: number }) {
  const related = useCrossReferences(verseId, RELATED_LIMIT);
  if (related.isPending) return <LoadingState label="Finding related verses" />;
  if (related.isError) {
    return <FaithText variant="secondary">Related verses aren’t available right now.</FaithText>;
  }
  if (related.data.length === 0) {
    return <FaithText variant="secondary">No related verses are listed for this passage yet.</FaithText>;
  }
  return (
    <View style={styles.chips}>
      {related.data.map((range) => (
        <ScriptureReferenceChip
          key={`${toVerseId(range.start)}-${toVerseId(range.end)}`}
          range={range}
          onPress={(target) =>
            leaveSheetTo(bibleRoutes.reader(target.start.bookId, target.start.chapter, target.start.verse))
          }
        />
      ))}
    </View>
  );
}

/** The 8 verse actions from PRD §6.2 C, for a verse or a range. */
export function VerseActionSheet({ startVerseId, endVerseId, range }: VerseActionSheetProps) {
  const { colors } = useTheme();
  const versesQuery = useVerses(range);
  const annotations = useRangeAnnotations(startVerseId, endVerseId);
  const [isRelatedOpen, setRelatedOpen] = useState(false);

  const verses = useMemo(() => versesQuery.data ?? [], [versesQuery.data]);
  const verseIds = useMemo(
    () => (verses.length ? verses.map((verse) => verse.id) : (contiguousVerseIds(startVerseId, endVerseId) ?? [])),
    [verses, startVerseId, endVerseId],
  );
  const reference = rangeLabel(range);
  const actions = useVerseActions({
    startVerseId,
    endVerseId,
    verseIds,
    reference,
    passageText: passagePlainText(verses),
  });
  const isBookmarked = !!annotations.savedVerse;

  const handleAddNote = () => {
    const id = actions.addNote();
    if (id) leaveSheetTo(bibleRoutes.note(id));
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      accessibilityLabel={`Actions for ${reference}`}>
      {versesQuery.isPending ? (
        <LoadingState label={`Loading ${reference}`} />
      ) : (
        <ScriptureCard
          reference={reference}
          verses={verses}
          translationLabel={DEFAULT_TRANSLATION.abbreviation}
          numberOfLines={8}
        />
      )}
      {versesQuery.isError ? (
        <FaithText variant="secondary" color="danger">
          We couldn’t load the text of this passage. Actions still work.
        </FaithText>
      ) : null}

      <HighlightSwatches
        selected={sharedHighlightColor(verseIds, annotations.highlights)}
        hasHighlight={annotations.highlights.size > 0}
        isDisabled={verseIds.length === 0}
        onSelect={actions.highlight}
        onRemove={actions.removeHighlight}
      />

      {actions.errorMessage ? (
        <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
          {actions.errorMessage}
        </FaithText>
      ) : null}

      <View>
        <ListRow icon="note" title="Add note" onPress={handleAddNote} />
        {annotations.notes.map((note) => (
          <ListRow
            key={note.id}
            icon="edit"
            title={note.content.trim() ? note.content.trim().split('\n')[0] : 'Untitled note'}
            subtitle={`Your note · ${rangeLabel(idsToRange(note.startVerseId, note.endVerseId))}`}
            onPress={() => leaveSheetTo(bibleRoutes.note(note.id))}
          />
        ))}
        <Divider />
        <ListRow
          icon={isBookmarked ? 'bookmarkFilled' : 'bookmark'}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          onPress={actions.toggleBookmark}
          showChevron={false}
        />
        <ListRow
          icon="collection"
          title="Add to collection"
          onPress={() => leaveSheetTo(bibleRoutes.collectionsPicker(startVerseId, endVerseId))}
        />
        <ListRow
          icon="study"
          title="Open study"
          onPress={() => leaveSheetTo(bibleRoutes.study(startVerseId, endVerseId))}
        />
        <ListRow
          icon="related"
          title={isRelatedOpen ? 'Hide related verses' : 'Find related verses'}
          onPress={() => setRelatedOpen((open) => !open)}
          showChevron={false}
        />
        {isRelatedOpen ? <RelatedVerses verseId={startVerseId} /> : null}
        <ListRow icon="share" title="Share verse" onPress={() => void actions.share()} showChevron={false} />
        <ListRow
          icon="reflect"
          title="Start a reflection"
          onPress={() => leaveSheetTo(bibleRoutes.reflection(startVerseId, endVerseId))}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 24, paddingBottom: 48, gap: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
});
