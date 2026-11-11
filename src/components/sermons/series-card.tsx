import { StyleSheet, View } from 'react-native';

import { Card, FaithText } from '@/components/ui';
import { formatSermonDate } from '@/features/sermons/format';
import type { SeriesListItem } from '@/features/sermons/types';

export interface SeriesCardProps {
  series: SeriesListItem;
  onPress: (id: string) => void;
}

export function sermonCountLabel(count: number): string {
  return count === 1 ? '1 sermon' : `${count} sermons`;
}

function dateSpan(first: string | null, last: string | null): string | null {
  const from = formatSermonDate(first);
  const to = formatSermonDate(last);
  if (!from || !to) return from ?? to;
  return from === to ? from : `${from} – ${to}`;
}

export function SeriesCard({ series, onPress }: SeriesCardProps) {
  const details = [series.speaker, sermonCountLabel(series.sermonCount), dateSpan(series.firstSermonDate, series.lastSermonDate)]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card onPress={() => onPress(series.id)} accessibilityLabel={`${series.title}, ${details}`} accessibilityHint="Opens the series">
      <View style={styles.body}>
        <FaithText variant="label">Series</FaithText>
        <FaithText variant="title" numberOfLines={2}>
          {series.title}
        </FaithText>
        <FaithText variant="secondary">{details}</FaithText>
        {series.description ? (
          <FaithText variant="secondary" numberOfLines={2}>
            {series.description}
          </FaithText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ body: { gap: 6 } });
