import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlatList, ListViewToken, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { findBlockIndex, type ChapterBlock } from './paragraphs';

const MAX_SCROLL_RETRIES = 4;
const RETRY_DELAY_MS = 120;
/** Keep the target verse a little below the header rather than flush against it. */
const VIEW_POSITION = 0.12;

interface ReaderScrollOptions {
  blocks: readonly ChapterBlock[];
  /** Verse id to bring into view once the chapter has loaded. */
  targetVerseId: number | null;
  animated: boolean;
  onTopVerseChange: (verse: number, scrollOffset: number) => void;
}

/** Scroll-to-verse on open (with retries for virtualised rows) and top-verse tracking for the saved position. */
export function useReaderScroll({ blocks, targetVerseId, animated, onTopVerseChange }: ReaderScrollOptions) {
  const listRef = useRef<FlatList<ChapterBlock>>(null);
  const retries = useRef(0);
  const hasScrolled = useRef(false);
  const offset = useRef(0);
  const onTopVerseChangeRef = useRef(onTopVerseChange);

  useEffect(() => {
    onTopVerseChangeRef.current = onTopVerseChange;
  }, [onTopVerseChange]);

  useEffect(() => {
    if (hasScrolled.current || blocks.length === 0 || targetVerseId === null) return undefined;
    hasScrolled.current = true;
    const index = findBlockIndex(blocks, targetVerseId);
    if (index <= 0) return undefined;
    const frame = requestAnimationFrame(() =>
      listRef.current?.scrollToIndex({ index, animated, viewPosition: VIEW_POSITION }),
    );
    return () => cancelAnimationFrame(frame);
  }, [blocks, targetVerseId, animated]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      if (retries.current >= MAX_SCROLL_RETRIES) return;
      retries.current += 1;
      listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
      setTimeout(
        () => listRef.current?.scrollToIndex({ index: info.index, animated, viewPosition: VIEW_POSITION }),
        RETRY_DELAY_MS,
      );
    },
    [animated],
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);

  // FlatList forbids changing this callback after mount, so it is created once and reads refs.
  const [onViewableItemsChanged] = useState(() => ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const top = viewableItems.find((token) => token.isViewable && token.item)?.item as ChapterBlock | undefined;
    const firstVerse = top?.verses[0];
    if (firstVerse) onTopVerseChangeRef.current(firstVerse.verse, offset.current);
  });

  return { listRef, onScrollToIndexFailed, onScroll, onViewableItemsChanged };
}
