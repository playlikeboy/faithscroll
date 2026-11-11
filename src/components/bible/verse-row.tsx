import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import type { HighlightColorValue } from '@/features/bible/annotations/highlights';
import type { Verse } from '@/features/bible/types';
import { MIN_TOUCH_TARGET, scriptureLineHeight, useTheme } from '@/theme';

import { verseAccessibilityLabel } from './verse-label';

export interface VerseRowProps {
  verse: Verse;
  fontSize: number;
  highlight: HighlightColorValue | null;
  hasNote: boolean;
  isBookmarked: boolean;
  isSelected: boolean;
  isFlashing: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

const ACCESSIBILITY_ACTIONS = [
  { name: 'activate' as const },
  { name: 'longpress' as const, label: 'Select a range starting here' },
];

/** A single verse as its own accessible control (used when a screen reader is running). */
export function VerseRow({
  verse,
  fontSize,
  highlight,
  hasNote,
  isBookmarked,
  isSelected,
  isFlashing,
  onPress,
  onLongPress,
}: VerseRowProps) {
  const { colors } = useTheme();
  const background = highlight ? colors.highlight[highlight] : isSelected || isFlashing ? colors.surfaceMuted : undefined;

  const handleAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'longpress') onLongPress();
    else onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={verseAccessibilityLabel(verse.verse, verse.text, { highlight, hasNote, isBookmarked, isSelected })}
      accessibilityHint="Opens verse actions"
      accessibilityState={{ selected: isSelected }}
      accessibilityActions={ACCESSIBILITY_ACTIONS}
      onAccessibilityAction={handleAction}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, background ? { backgroundColor: background } : null, pressed && styles.pressed]}>
      <FaithText variant="caption" style={[styles.number, { color: colors.verseNumber }]}>
        {verse.verse}
      </FaithText>
      <FaithText variant="scripture" style={[styles.text, { fontSize, lineHeight: scriptureLineHeight(fontSize) }]}>
        {verse.text}
      </FaithText>
      {hasNote || isBookmarked ? (
        <View style={styles.badges}>
          {hasNote ? <Icon name="note" size={14} color={colors.verseNumber} /> : null}
          {isBookmarked ? <Icon name="bookmarkFilled" size={14} color={colors.verseNumber} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, minHeight: MIN_TOUCH_TARGET, paddingVertical: 4, borderRadius: 6 },
  pressed: { opacity: 0.7 },
  number: { width: 24, textAlign: 'right', paddingTop: 6 },
  text: { flex: 1 },
  badges: { gap: 4, paddingTop: 6 },
});
