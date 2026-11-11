import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { FaithText } from '@/components/ui';
import type { ChapterMarkers } from '@/features/bible/reader/markers';
import type { ChapterBlock } from '@/features/bible/reader/paragraphs';
import type { Verse } from '@/features/bible/types';
import { scriptureLineHeight, useTheme, type Theme } from '@/theme';

import { VerseRow } from './verse-row';

export type ChapterLayout = 'flow' | 'rows';

export interface ChapterBlockViewProps {
  block: ChapterBlock;
  fontSize: number;
  markers: ChapterMarkers;
  /** Range-selection anchor (long-pressed verse). */
  anchorVerseId: number | null;
  /** Verse briefly emphasised after opening with `?verse=`. */
  flashVerseId: number | null;
  /** 'flow' wraps verses as paragraphs; 'rows' gives each verse its own accessible row (screen readers). */
  layout: ChapterLayout;
  onPressVerse: (verseId: number) => void;
  onLongPressVerse: (verseId: number) => void;
}

const POETRY_INDENT = 22;
const NOTE_GLYPH = '✎';
const BOOKMARK_GLYPH = '•';

function spanStyle(verse: Verse, props: ChapterBlockViewProps, { colors }: Theme): TextStyle | undefined {
  const color = props.markers.highlights.get(verse.id);
  const isEmphasised = props.anchorVerseId === verse.id || props.flashVerseId === verse.id;
  if (!color && !isEmphasised) return undefined;
  return {
    backgroundColor: color ? colors.highlight[color] : colors.surfaceMuted,
    textDecorationLine: isEmphasised ? 'underline' : 'none',
    textDecorationColor: colors.gold,
  };
}

function FlowParagraph(props: ChapterBlockViewProps) {
  const theme = useTheme();
  const { block, fontSize, markers, onPressVerse, onLongPressVerse } = props;
  const numberStyle = { fontSize: Math.round(fontSize * 0.6), color: theme.colors.verseNumber };
  const separator = block.poetry ? '\n' : ' ';

  const spans: ReactNode[] = block.verses.map((verse, index) => (
    <Text key={verse.id}>
      <Text
        onPress={() => onPressVerse(verse.id)}
        onLongPress={() => onLongPressVerse(verse.id)}
        style={spanStyle(verse, props, theme)}>
        <Text style={numberStyle}>
          {verse.verse}
          {markers.noteVerseIds.has(verse.id) ? NOTE_GLYPH : ''}
          {markers.bookmarkVerseIds.has(verse.id) ? BOOKMARK_GLYPH : ''}
          {' '}
        </Text>
        {verse.text}
      </Text>
      {index < block.verses.length - 1 ? separator : ''}
    </Text>
  ));

  return (
    <FaithText
      variant="scripture"
      style={[{ fontSize, lineHeight: scriptureLineHeight(fontSize) }, block.poetry && styles.poetry]}>
      {spans}
    </FaithText>
  );
}

function VerseRows(props: ChapterBlockViewProps) {
  const { block, fontSize, markers, anchorVerseId, flashVerseId, onPressVerse, onLongPressVerse } = props;
  return (
    <View style={block.poetry ? styles.poetry : undefined}>
      {block.verses.map((verse) => (
        <VerseRow
          key={verse.id}
          verse={verse}
          fontSize={fontSize}
          highlight={markers.highlights.get(verse.id) ?? null}
          hasNote={markers.noteVerseIds.has(verse.id)}
          isBookmarked={markers.bookmarkVerseIds.has(verse.id)}
          isSelected={anchorVerseId === verse.id}
          isFlashing={flashVerseId === verse.id}
          onPress={() => onPressVerse(verse.id)}
          onLongPress={() => onLongPressVerse(verse.id)}
        />
      ))}
    </View>
  );
}

/** One heading + paragraph (or stanza) of a chapter. */
export const ChapterBlockView = memo(function ChapterBlockView(props: ChapterBlockViewProps) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.block}>
      {props.block.heading ? (
        <FaithText
          accessibilityRole="header"
          style={[styles.heading, { fontFamily: fonts.serifMedium, color: colors.textSecondary }]}>
          {props.block.heading}
        </FaithText>
      ) : null}
      {props.layout === 'rows' ? <VerseRows {...props} /> : <FlowParagraph {...props} />}
    </View>
  );
});

const styles = StyleSheet.create({
  block: { paddingBottom: 14 },
  heading: { fontSize: 18, lineHeight: 26, marginTop: 18, marginBottom: 8 },
  poetry: { paddingLeft: POETRY_INDENT },
});
