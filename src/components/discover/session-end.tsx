import { StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, Icon } from '@/components/ui';
import { useTheme } from '@/theme';

export interface SessionEndProps {
  /** e.g. "Romans 8" — the chapter behind the last passage, if any. */
  chapterLabel: string | null;
  onReadChapter: () => void;
  onChooseTopic: () => void;
}

/** A calm stopping point. No "load more", no next-session autoplay. */
export function SessionEnd({ chapterLabel, onReadChapter, onChooseTopic }: SessionEndProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.end} accessibilityLiveRegion="polite">
      <Icon name="check" size={22} color={colors.primaryText} />
      <FaithText variant="title" align="center" accessibilityRole="header">
        You&apos;ve reached the end of this session
      </FaithText>
      <FaithText variant="secondary" align="center" style={styles.message}>
        {chapterLabel
          ? `Take a moment with what you've read, or keep going with ${chapterLabel} in context.`
          : "Take a moment with what you've read."}
      </FaithText>
      <View style={styles.buttons}>
        {chapterLabel ? (
          <FaithButton
            label="Read the full chapter"
            icon="bible"
            onPress={onReadChapter}
            accessibilityHint={`Opens ${chapterLabel}`}
            fullWidth
          />
        ) : null}
        <FaithButton label="Choose another topic" variant="secondary" onPress={onChooseTopic} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  end: { alignItems: 'center', gap: 10, paddingTop: 32, paddingBottom: 16 },
  message: { maxWidth: 320 },
  buttons: { alignSelf: 'stretch', gap: 10, marginTop: 12 },
});
