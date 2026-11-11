import { StyleSheet, View } from 'react-native';

import { Card, FaithText, Icon } from '@/components/ui';
import { formatSermonDate } from '@/features/sermons/format';
import type { SermonListItem } from '@/features/sermons/types';
import { formatDuration } from '@/lib/time';
import { tabularNums, useTheme } from '@/theme';

import { StatusBadge } from './status-badge';

export interface SermonCardProps {
  sermon: SermonListItem;
  onPress: (id: string) => void;
}

function metaLine(sermon: SermonListItem): string {
  return [sermon.speaker, sermon.church, formatSermonDate(sermon.sermonDate)].filter(Boolean).join(' · ');
}

function accessibilityText(sermon: SermonListItem): string {
  const parts = [
    sermon.title,
    metaLine(sermon),
    sermon.seriesTitle ? `Series: ${sermon.seriesTitle}` : null,
    sermon.mainPassage,
    sermon.totalDurationMs > 0 ? `Recording ${formatDuration(sermon.totalDurationMs)}` : null,
  ];
  return parts.filter(Boolean).join(', ');
}

/** Editorial library row: serif title, quiet metadata, passage and AI badges. */
export function SermonCard({ sermon, onPress }: SermonCardProps) {
  const { colors } = useTheme();
  const meta = metaLine(sermon);
  return (
    <Card onPress={() => onPress(sermon.id)} accessibilityLabel={accessibilityText(sermon)} accessibilityHint="Opens the sermon">
      <View style={styles.body}>
        {sermon.seriesTitle ? (
          <FaithText variant="label" numberOfLines={1}>
            {sermon.seriesTitle}
          </FaithText>
        ) : null}
        <FaithText variant="title" numberOfLines={2}>
          {sermon.title}
        </FaithText>
        {meta ? (
          <FaithText variant="secondary" numberOfLines={2}>
            {meta}
          </FaithText>
        ) : null}
        <View style={styles.footer}>
          {sermon.mainPassage ? (
            <View style={[styles.passage, { backgroundColor: colors.surfaceMuted }]}>
              <Icon name="bible" size={12} color={colors.primaryText} />
              <FaithText variant="caption" weight="600" style={{ color: colors.primaryText }} numberOfLines={1}>
                {sermon.mainPassage}
              </FaithText>
            </View>
          ) : null}
          {sermon.totalDurationMs > 0 ? (
            <View style={styles.inline}>
              <Icon name="waveform" size={14} color={colors.textSecondary} />
              <FaithText variant="caption" style={tabularNums}>
                {formatDuration(sermon.totalDurationMs)}
              </FaithText>
            </View>
          ) : null}
          {sermon.bookmarkCount > 0 ? (
            <View style={styles.inline}>
              <Icon name="bookmarkFilled" size={12} color={colors.textSecondary} />
              <FaithText variant="caption">{sermon.bookmarkCount}</FaithText>
            </View>
          ) : null}
        </View>
        {sermon.transcriptStatus || sermon.recapStatus ? (
          <View style={styles.footer}>
            {sermon.transcriptStatus ? <StatusBadge icon="transcript" label="Transcript" status={sermon.transcriptStatus} /> : null}
            {sermon.recapStatus ? <StatusBadge icon="sparkles" label="Recap" status={sermon.recapStatus} /> : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: 6 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 4 },
  passage: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, maxWidth: '70%' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
