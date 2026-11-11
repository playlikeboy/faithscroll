/**
 * Inline Markdown-lite nodes rendered as nested <Text>. Timestamps are small tabular-numeral
 * pills; Scripture references are underlined links. Both are tappable only when a handler is given.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { VerseRange } from '@/features/bible/types';
import { referenceLabel, timestampLabel } from '@/features/editor/labels';
import type { NoteInline } from '@/features/editor/markdown';
import { tabularNums, useThemedStyles, type Theme } from '@/theme';

export interface InlineHandlers {
  onPressTimestamp?: (positionMs: number) => void;
  onPressReference?: (range: VerseRange) => void;
}

/** Thin spaces give the timestamp background pill a little horizontal padding. */
const PILL_PAD = ' ';

type InlineStyles = ReturnType<typeof createStyles>;

function renderNode(node: NoteInline, key: number, styles: InlineStyles, handlers: InlineHandlers): ReactNode {
  switch (node.type) {
    case 'text':
      return node.text;
    case 'bold':
    case 'italic':
    case 'highlight':
      return (
        <Text key={key} style={styles[node.type]}>
          {node.children.map((child, i) => renderNode(child, i, styles, handlers))}
        </Text>
      );
    case 'timestamp': {
      const onPress = handlers.onPressTimestamp;
      return (
        <Text
          key={key}
          style={styles.timestamp}
          accessibilityRole={onPress ? 'link' : undefined}
          accessibilityLabel={onPress ? timestampLabel(node.positionMs) : undefined}
          onPress={onPress ? () => onPress(node.positionMs) : undefined}>
          {PILL_PAD}
          {node.text}
          {PILL_PAD}
        </Text>
      );
    }
    case 'reference': {
      const onPress = handlers.onPressReference;
      return (
        <Text
          key={key}
          style={onPress ? styles.referenceLink : styles.reference}
          accessibilityRole={onPress ? 'link' : undefined}
          accessibilityLabel={onPress ? referenceLabel(node.range, node.text) : undefined}
          onPress={onPress ? () => onPress(node.range) : undefined}>
          {node.text}
        </Text>
      );
    }
  }
}

export interface InlineContentProps extends InlineHandlers {
  nodes: readonly NoteInline[];
}

/** Render inline nodes; must be placed inside a <Text>. */
export function InlineContent({ nodes, onPressTimestamp, onPressReference }: InlineContentProps) {
  const styles = useThemedStyles(createStyles);
  const handlers = { onPressTimestamp, onPressReference };
  return <>{nodes.map((node, i) => renderNode(node, i, styles, handlers))}</>;
}

/** True when the nodes contain something tappable for the given handlers. */
export function hasInteractiveNodes(nodes: readonly NoteInline[], handlers: InlineHandlers): boolean {
  return nodes.some((node) => {
    if (node.type === 'timestamp') return handlers.onPressTimestamp !== undefined;
    if (node.type === 'reference') return handlers.onPressReference !== undefined;
    return 'children' in node && hasInteractiveNodes(node.children, handlers);
  });
}

const createStyles = ({ colors, fonts, fontSizes }: Theme) =>
  StyleSheet.create({
    bold: { fontWeight: '600' },
    italic: { fontStyle: 'italic' },
    highlight: { backgroundColor: colors.highlight.gold, color: colors.text },
    timestamp: {
      ...tabularNums,
      fontFamily: fonts.sans,
      fontSize: fontSizes.secondary,
      fontWeight: '600',
      fontStyle: 'normal',
      color: colors.primaryText,
      backgroundColor: colors.surfaceMuted,
    },
    reference: { color: colors.primaryText, fontWeight: '500' },
    referenceLink: {
      color: colors.primaryText,
      fontWeight: '500',
      textDecorationLine: 'underline',
      textDecorationColor: colors.accent,
    },
  });
