import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { formatSermonDate } from '@/features/sermons/format';
import type { SermonListItem } from '@/features/sermons/types';
import { formatDuration } from '@/lib/time';
import { MIN_TOUCH_TARGET, tabularNums, useTheme } from '@/theme';

export interface SeriesTimelineProps {
  sermons: readonly SermonListItem[];
  onOpenSermon: (id: string) => void;
}

/** Sermons of a series in date order, drawn as a quiet vertical timeline. */
export function SeriesTimeline({ sermons, onOpenSermon }: SeriesTimelineProps) {
  const { colors } = useTheme();
  if (sermons.length === 0) {
    return <FaithText variant="secondary">No sermons in this series yet. Choose this series when you add or edit a sermon.</FaithText>;
  }
  return (
    <View>
      {sermons.map((sermon, index) => {
        const date = formatSermonDate(sermon.sermonDate);
        const details = [sermon.speaker, sermon.mainPassage, sermon.totalDurationMs > 0 ? formatDuration(sermon.totalDurationMs) : null]
          .filter(Boolean)
          .join(' · ');
        const isLast = index === sermons.length - 1;
        return (
          <Pressable
            key={sermon.id}
            accessibilityRole="button"
            accessibilityLabel={[`Week ${index + 1}`, sermon.title, date, details].filter(Boolean).join(', ')}
            accessibilityHint="Opens the sermon"
            onPress={() => onOpenSermon(sermon.id)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: colors.primaryText }]} />
              {isLast ? null : <View style={[styles.line, { backgroundColor: colors.border }]} />}
            </View>
            <View style={styles.body}>
              <FaithText variant="label">{date ?? `Sermon ${index + 1}`}</FaithText>
              <FaithText variant="heading">{sermon.title}</FaithText>
              {details ? (
                <FaithText variant="secondary" style={tabularNums}>
                  {details}
                </FaithText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, minHeight: MIN_TOUCH_TARGET },
  pressed: { opacity: 0.6 },
  rail: { width: 12, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  line: { flex: 1, width: 2, marginTop: 4 },
  body: { flex: 1, gap: 2, paddingBottom: 20 },
});
