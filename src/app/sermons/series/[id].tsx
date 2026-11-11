import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui';
import { parseIdParam } from '@/features/sermons/route-params';
import { SeriesDetailScreen } from '@/features/sermons/series-detail-screen';

export default function SeriesDetailRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const seriesId = parseIdParam(params.id);
  if (!seriesId) return <EmptyState icon="list" title="This series isn't available" />;
  return <SeriesDetailScreen key={seriesId} seriesId={seriesId} />;
}
