import { StyleSheet, View } from 'react-native';

import { Chip, FaithText } from '@/components/ui';
import { formatSermonDate } from '@/features/sermons/format';
import type { SermonRow } from '@/features/sermons/types';

export interface SermonHeaderProps {
  sermon: SermonRow;
  seriesTitle: string | null;
  onOpenSeries?: () => void;
  onOpenPassage?: () => void;
}

/** Editorial header: series, serif title, speaker · church · date and the main passage chip. */
export function SermonHeader({ sermon, seriesTitle, onOpenSeries, onOpenPassage }: SermonHeaderProps) {
  const meta = [sermon.speaker, sermon.church, formatSermonDate(sermon.sermonDate)].filter(Boolean).join(' · ');
  return (
    <View style={styles.header}>
      {seriesTitle ? (
        onOpenSeries ? (
          <Chip label={`Series · ${seriesTitle}`} onPress={onOpenSeries} accessibilityHint="Opens the series" />
        ) : (
          <FaithText variant="label">{seriesTitle}</FaithText>
        )
      ) : null}
      <FaithText variant="display" accessibilityRole="header">
        {sermon.title}
      </FaithText>
      {meta ? <FaithText variant="secondary">{meta}</FaithText> : null}
      {sermon.mainPassage ? (
        <View style={styles.passage}>
          <Chip label={sermon.mainPassage} icon="bible" onPress={onOpenPassage} accessibilityHint="Opens the passage in the Bible reader" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, alignItems: 'flex-start' },
  passage: { marginTop: 4 },
});
