import { Pressable, StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, Icon, IconButton } from '@/components/ui';
import type { ChapterLocation } from '@/features/bible/books';
import { chapterTitle } from '@/features/bible/reader/format';
import { MIN_TOUCH_TARGET, SCRIPTURE_SIZES, useTheme } from '@/theme';

export function HeaderTitleButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. Choose another book or chapter`}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.headerTitle, pressed && styles.pressed]}>
      <FaithText style={{ fontFamily: fonts.serifMedium, fontSize: 17 }}>{title}</FaithText>
      <Icon name="down" size={12} color={colors.textSecondary} />
    </Pressable>
  );
}

export interface ChapterHeadingProps {
  bookName: string;
  chapter: number;
  translationLabel: string;
}

export function ChapterHeading({ bookName, chapter, translationLabel }: ChapterHeadingProps) {
  return (
    <View style={styles.chapterHeading}>
      <FaithText variant="label">{bookName}</FaithText>
      <FaithText variant="display" accessibilityRole="header">
        {`Chapter ${chapter}`}
      </FaithText>
      <FaithText variant="caption">{translationLabel}</FaithText>
    </View>
  );
}

export interface ChapterNavFooterProps {
  previous: ChapterLocation | null;
  next: ChapterLocation | null;
  attribution: string;
  onNavigate: (location: ChapterLocation) => void;
}

export function ChapterNavFooter({ previous, next, attribution, onNavigate }: ChapterNavFooterProps) {
  return (
    <View style={styles.footer}>
      <View style={styles.footerButtons}>
        {previous ? (
          <FaithButton
            variant="secondary"
            icon="back"
            label={chapterTitle(previous.bookId, previous.chapter)}
            accessibilityHint="Opens the previous chapter"
            onPress={() => onNavigate(previous)}
            style={styles.footerButton}
          />
        ) : null}
        {next ? (
          <FaithButton
            variant="primary"
            icon="forward"
            label={chapterTitle(next.bookId, next.chapter)}
            accessibilityHint="Opens the next chapter"
            onPress={() => onNavigate(next)}
            style={styles.footerButton}
          />
        ) : null}
      </View>
      <FaithText variant="caption" align="center">
        {attribution}
      </FaithText>
    </View>
  );
}

export interface TextSizeBarProps {
  sizeIndex: number;
  onChange: (nextIndex: number) => void;
}

export function TextSizeBar({ sizeIndex, onChange }: TextSizeBarProps) {
  const { colors } = useTheme();
  const isSmallest = sizeIndex <= 0;
  const isLargest = sizeIndex >= SCRIPTURE_SIZES.length - 1;
  return (
    <View style={[styles.sizeBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <IconButton
        icon="textSize"
        size={16}
        accessibilityLabel="Smaller text"
        isDisabled={isSmallest}
        onPress={() => onChange(sizeIndex - 1)}
      />
      <FaithText variant="secondary" accessibilityLiveRegion="polite">
        {`Text size ${sizeIndex + 1} of ${SCRIPTURE_SIZES.length}`}
      </FaithText>
      <IconButton
        icon="textSize"
        size={24}
        accessibilityLabel="Larger text"
        isDisabled={isLargest}
        onPress={() => onChange(sizeIndex + 1)}
      />
    </View>
  );
}

export interface SelectionBarProps {
  startLabel: string;
  onCancel: () => void;
  onUseSingleVerse: () => void;
}

/** Shown while selecting a multi-verse range. */
export function SelectionBar({ startLabel, onCancel, onUseSingleVerse }: SelectionBarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.selectionBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLiveRegion="polite">
      <FaithText variant="secondary" style={styles.selectionText}>
        {`Selecting from ${startLabel}. Tap the last verse of the passage.`}
      </FaithText>
      <View style={styles.selectionActions}>
        <FaithButton label="Just this verse" variant="secondary" onPress={onUseSingleVerse} />
        <FaithButton label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH_TARGET, paddingHorizontal: 8 },
  pressed: { opacity: 0.6 },
  chapterHeading: { paddingTop: 16, paddingBottom: 20, gap: 4 },
  footer: { paddingTop: 24, paddingBottom: 48, gap: 20 },
  footerButtons: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  footerButton: { flexGrow: 1 },
  sizeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  selectionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    padding: 14,
    gap: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectionText: { flexShrink: 1 },
  selectionActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
