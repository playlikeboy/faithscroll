import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, IconButton, LoadingState } from '@/components/ui';
import { getBook, nextChapter, previousChapter, type ChapterLocation } from '@/features/bible/books';
import { useReduceMotion, useScreenReaderEnabled } from '@/features/bible/hooks/use-accessibility-settings';
import { useChapter } from '@/features/bible/hooks/use-bible-text';
import { useChapterAnnotations } from '@/features/bible/hooks/use-chapter-annotations';
import { chapterTitle, rangeLabel } from '@/features/bible/reader/format';
import { buildChapterBlocks, type ChapterBlock } from '@/features/bible/reader/paragraphs';
import { bibleRoutes } from '@/features/bible/reader/routes';
import { resolveVersePress } from '@/features/bible/reader/selection';
import { useReaderScroll } from '@/features/bible/reader/use-reader-scroll';
import { useReaderSession } from '@/features/bible/reader/use-reader-session';
import { DEFAULT_TRANSLATION } from '@/features/bible/repository';
import { idsToRange, toVerseId } from '@/features/bible/verse-id';
import { logger } from '@/lib/logger';
import { usePreferences } from '@/stores/preferences';
import { GUTTER, SCRIPTURE_SIZES, useTheme } from '@/theme';

import { ChapterBlockView } from './chapter-block';
import { ChapterHeading, ChapterNavFooter, HeaderTitleButton, SelectionBar, TextSizeBar } from './reader-chrome';

/** How long a verse opened via `?verse=` stays emphasised. */
const FLASH_DURATION_MS = 2400;
const SELECTION_BAR_SPACE = 140;

export interface ChapterReaderProps {
  bookId: number;
  chapter: number;
  verse?: number;
}

function useFontSize() {
  const sizeIndex = usePreferences((s) => s.scriptureSizeIndex);
  const setSizeIndex = usePreferences((s) => s.setScriptureSizeIndex);
  const safeIndex = Math.min(SCRIPTURE_SIZES.length - 1, Math.max(0, sizeIndex));
  return { sizeIndex: safeIndex, fontSize: SCRIPTURE_SIZES[safeIndex], setSizeIndex };
}

function useFlash(initialVerseId: number | null): number | null {
  const [flashVerseId, setFlashVerseId] = useState(initialVerseId);
  useEffect(() => {
    if (flashVerseId === null) return undefined;
    const timer = setTimeout(() => setFlashVerseId(null), FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [flashVerseId]);
  return flashVerseId;
}

/** Editorial chapter view with verse actions, range selection and saved reading position. */
export function ChapterReader({ bookId, chapter, verse }: ChapterReaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const book = getBook(bookId);
  const chapterQuery = useChapter(bookId, chapter);
  const { markers, error: annotationsError } = useChapterAnnotations(bookId, chapter);
  const { initial, reportPosition } = useReaderSession(bookId, chapter, verse);
  const isScreenReaderEnabled = useScreenReaderEnabled();
  const isReduceMotionEnabled = useReduceMotion();
  const { sizeIndex, fontSize, setSizeIndex } = useFontSize();
  const [isSizeBarOpen, setSizeBarOpen] = useState(false);
  const [anchorVerseId, setAnchorVerseId] = useState<number | null>(null);

  const targetVerseId = initial.verse ? toVerseId({ bookId, chapter, verse: initial.verse }) : null;
  const flashVerseId = useFlash(initial.flash ? targetVerseId : null);
  const blocks = useMemo(() => buildChapterBlocks(chapterQuery.data ?? []), [chapterQuery.data]);
  const { listRef, onScroll, onViewableItemsChanged, onScrollToIndexFailed } = useReaderScroll({
    blocks,
    targetVerseId,
    animated: initial.flash && !isReduceMotionEnabled,
    onTopVerseChange: reportPosition,
  });

  useEffect(() => {
    if (annotationsError) logger.error('Could not load chapter annotations', annotationsError);
  }, [annotationsError]);

  useEffect(() => {
    if (chapterQuery.error) logger.error('Could not load chapter', chapterQuery.error, { bookId, chapter });
  }, [chapterQuery.error, bookId, chapter]);

  const title = chapterTitle(bookId, chapter);
  const openBooks = useCallback(() => router.push(bibleRoutes.books({ replaceReader: true })), []);

  const handlePressVerse = useCallback(
    (verseId: number) => {
      const { start, end } = resolveVersePress(anchorVerseId, verseId);
      setAnchorVerseId(null);
      router.push(bibleRoutes.verseActions(start, end));
    },
    [anchorVerseId],
  );

  const handleLongPressVerse = useCallback((verseId: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setAnchorVerseId(verseId);
    AccessibilityInfo.announceForAccessibility('Range started. Choose the last verse of the passage.');
  }, []);

  const handleNavigate = useCallback(
    (location: ChapterLocation) => router.replace(bibleRoutes.reader(location.bookId, location.chapter)),
    [],
  );

  const renderItem: ListRenderItem<ChapterBlock> = useCallback(
    ({ item }) => (
      <ChapterBlockView
        block={item}
        fontSize={fontSize}
        markers={markers}
        anchorVerseId={anchorVerseId}
        flashVerseId={flashVerseId}
        layout={isScreenReaderEnabled ? 'rows' : 'flow'}
        onPressVerse={handlePressVerse}
        onLongPressVerse={handleLongPressVerse}
      />
    ),
    [fontSize, markers, anchorVerseId, flashVerseId, isScreenReaderEnabled, handlePressVerse, handleLongPressVerse],
  );

  const header = (
    <Stack.Screen
      options={{
        title,
        headerTitle: () => <HeaderTitleButton title={title} onPress={openBooks} />,
        headerRight: () => (
          <IconButton
            icon="textSize"
            accessibilityLabel={isSizeBarOpen ? 'Hide text size' : 'Text size'}
            isSelected={isSizeBarOpen}
            onPress={() => setSizeBarOpen((open) => !open)}
          />
        ),
      }}
    />
  );

  if (chapterQuery.isPending) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {header}
        <LoadingState label={`Loading ${title}`} />
      </View>
    );
  }

  if (chapterQuery.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {header}
        <ErrorState
          title="This chapter didn't open"
          message="Something went wrong reading the Bible on this device. Please try again."
          onRetry={() => void chapterQuery.refetch()}
        />
      </View>
    );
  }

  if (blocks.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {header}
        <EmptyState
          icon="bible"
          title={`${title} isn't available yet`}
          message="The Bible text is still being prepared on this device."
          actionLabel="Choose another chapter"
          onAction={openBooks}
        />
      </View>
    );
  }

  const anchorLabel = anchorVerseId ? rangeLabel(idsToRange(anchorVerseId)) : '';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {header}
      <FlatList
        ref={listRef}
        data={blocks}
        keyExtractor={(block) => block.key}
        renderItem={renderItem}
        extraData={renderItem}
        initialNumToRender={8}
        windowSize={11}
        onScroll={onScroll}
        scrollEventThrottle={250}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={onScrollToIndexFailed}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (anchorVerseId ? SELECTION_BAR_SPACE : 0) },
        ]}
        ListHeaderComponent={
          <View>
            {isSizeBarOpen ? <TextSizeBar sizeIndex={sizeIndex} onChange={setSizeIndex} /> : null}
            <ChapterHeading
              bookName={book?.name ?? ''}
              chapter={chapter}
              translationLabel={`${DEFAULT_TRANSLATION.name} (${DEFAULT_TRANSLATION.abbreviation})`}
            />
          </View>
        }
        ListFooterComponent={
          <ChapterNavFooter
            previous={previousChapter({ bookId, chapter })}
            next={nextChapter({ bookId, chapter })}
            attribution={DEFAULT_TRANSLATION.attribution}
            onNavigate={handleNavigate}
          />
        }
      />
      {anchorVerseId ? (
        <SelectionBar
          startLabel={anchorLabel}
          onCancel={() => setAnchorVerseId(null)}
          onUseSingleVerse={() => handlePressVerse(anchorVerseId)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER },
});
