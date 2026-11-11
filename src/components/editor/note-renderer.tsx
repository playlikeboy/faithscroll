/**
 * Renders Markdown-lite content (see `src/features/editor/markdown.ts`): headings in Literata,
 * paragraphs and lists in the system font, bold/italic, gold ==highlights==, tappable `[mm:ss]`
 * timestamps and tappable Scripture references.
 *
 * Text is selectable for copying, except in blocks that contain tappable tokens (selection
 * would compete with the taps).
 */
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { VerseRange } from '@/features/bible/types';
import { parseNote, type NoteBlock, type NoteInline } from '@/features/editor/markdown';
import { spacing, tabularNums, useThemedStyles, type Theme } from '@/theme';

import { InlineContent, hasInteractiveNodes, type InlineHandlers } from './note-inline';

export interface NoteRendererProps {
  content: string;
  onPressTimestamp?: (positionMs: number) => void;
  onPressReference?: (range: VerseRange) => void;
  /** Allow selecting/copying text. Default true. */
  selectable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Heading sizes relative to the 17pt body (PRD §10: section 21–24). */
const HEADING_TYPE = {
  1: { fontSize: 24, lineHeight: 31 },
  2: { fontSize: 21, lineHeight: 28 },
  3: { fontSize: 18, lineHeight: 25 },
} as const;

type Styles = ReturnType<typeof createStyles>;

interface BlockProps extends InlineHandlers {
  block: NoteBlock;
  styles: Styles;
  selectable: boolean;
}

function InlineText({
  nodes,
  style,
  selectable,
  handlers,
}: {
  nodes: readonly NoteInline[];
  style: StyleProp<TextStyle>;
  selectable: boolean;
  handlers: InlineHandlers;
}) {
  return (
    <Text style={style} selectable={selectable && !hasInteractiveNodes(nodes, handlers)}>
      <InlineContent nodes={nodes} {...handlers} />
    </Text>
  );
}

function ListBlock({ items, start, styles, selectable, handlers }: {
  items: readonly NoteInline[][];
  start: number | null;
  styles: Styles;
  selectable: boolean;
  handlers: InlineHandlers;
}) {
  return (
    <View style={styles.list}>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <Text style={[styles.body, styles.marker]} accessibilityLabel={start === null ? 'Bullet' : `${start + i}.`}>
            {start === null ? '•' : `${start + i}.`}
          </Text>
          <InlineText nodes={item} style={[styles.body, styles.listText]} selectable={selectable} handlers={handlers} />
        </View>
      ))}
    </View>
  );
}

const Block = memo(function Block({ block, styles, selectable, onPressTimestamp, onPressReference }: BlockProps) {
  const handlers = { onPressTimestamp, onPressReference };
  switch (block.type) {
    case 'heading':
      return (
        <Text accessibilityRole="header" style={[styles.heading, styles[`h${block.level}`]]} selectable={selectable && !hasInteractiveNodes(block.children, handlers)}>
          <InlineContent nodes={block.children} {...handlers} />
        </Text>
      );
    case 'paragraph':
      return <InlineText nodes={block.children} style={styles.body} selectable={selectable} handlers={handlers} />;
    case 'bulletList':
      return <ListBlock items={block.items} start={null} styles={styles} selectable={selectable} handlers={handlers} />;
    case 'numberedList':
      return <ListBlock items={block.items} start={block.start} styles={styles} selectable={selectable} handlers={handlers} />;
  }
});

export function NoteRenderer({ content, onPressTimestamp, onPressReference, selectable = true, style, testID }: NoteRendererProps) {
  const styles = useThemedStyles(createStyles);
  const blocks = useMemo(() => parseNote(content), [content]);
  if (blocks.length === 0) return null;
  return (
    <View style={[styles.container, style]} testID={testID}>
      {blocks.map((block, i) => (
        <Block
          key={i}
          block={block}
          styles={styles}
          selectable={selectable}
          onPressTimestamp={onPressTimestamp}
          onPressReference={onPressReference}
        />
      ))}
    </View>
  );
}

const createStyles = ({ colors, fonts, fontSizes }: Theme) =>
  StyleSheet.create({
    container: { gap: spacing.md },
    body: { fontFamily: fonts.sans, fontSize: fontSizes.body, lineHeight: 24, color: colors.text },
    heading: { color: colors.text, marginTop: spacing.xs },
    h1: { fontFamily: fonts.serifSemiBold, ...HEADING_TYPE[1] },
    h2: { fontFamily: fonts.serifMedium, ...HEADING_TYPE[2] },
    h3: { fontFamily: fonts.serifMedium, ...HEADING_TYPE[3] },
    list: { gap: spacing.xs },
    listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    marker: { ...tabularNums, minWidth: spacing.xl - spacing.xs, textAlign: 'right', color: colors.textSecondary },
    listText: { flex: 1 },
  });
