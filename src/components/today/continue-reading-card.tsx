import { StyleSheet, View } from 'react-native';

import { Card, FaithButton, FaithText } from '@/components/ui';
import type { ContinueReading } from '@/features/today/activity';
import { useTheme } from '@/theme';

export interface ContinueReadingCardProps {
  progress: ContinueReading | null;
  onResume: () => void;
  onStart: () => void;
}

/** One-tap resume (the Today screen's primary action), or a gentle first step into John. */
export function ContinueReadingCard({ progress, onResume, onStart }: ContinueReadingCardProps) {
  const { colors } = useTheme();

  if (!progress) {
    return (
      <Card tone="muted" style={styles.card}>
        <FaithText variant="label">Start reading</FaithText>
        <FaithText variant="title">Begin with the Gospel of John</FaithText>
        <FaithText variant="secondary">A good first step: the story of Jesus, told simply and beautifully.</FaithText>
        <FaithButton label="Start with John 1" icon="bible" onPress={onStart} style={styles.button} />
      </Card>
    );
  }

  const { bookName, chapter, totalChapters } = progress;
  const fraction = totalChapters > 0 ? Math.min(1, chapter / totalChapters) : 0;
  const place = `${bookName} ${chapter}`;

  return (
    <Card tone="muted" style={styles.card}>
      <FaithText variant="label">Continue reading</FaithText>
      <FaithText variant="title">{place}</FaithText>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${bookName} progress`}
        accessibilityValue={{ min: 0, max: totalChapters, now: chapter, text: `Chapter ${chapter} of ${totalChapters}` }}
        style={styles.progressRow}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { backgroundColor: colors.primaryText, width: `${fraction * 100}%` }]} />
        </View>
        <FaithText variant="caption">
          Chapter {chapter} of {totalChapters}
        </FaithText>
      </View>
      <FaithButton
        label="Resume"
        icon="bible"
        onPress={onResume}
        accessibilityHint={`Opens ${place} where you left off`}
        style={styles.button}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 20 },
  progressRow: { gap: 6, marginTop: 4 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  button: { marginTop: 8 },
});
