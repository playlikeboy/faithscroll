import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/ui';
import { parseIdParam, parsePositionParam } from '@/features/sermons/route-params';
import { SermonDetailScreen } from '@/features/sermons/sermon-detail-screen';

/** `/sermons/[id]?t=<ms>&recordingId=<id>` — `t` seeks to that moment (sermon timeline, or inside `recordingId`). */
export default function SermonDetailRoute() {
  const params = useLocalSearchParams<{ id: string; t?: string; recordingId?: string }>();
  const sermonId = parseIdParam(params.id);
  if (!sermonId) return <EmptyState icon="sermons" title="This sermon isn't available" />;
  return (
    <SermonDetailScreen
      key={sermonId}
      sermonId={sermonId}
      initialPositionMs={parsePositionParam(params.t)}
      initialRecordingId={parseIdParam(params.recordingId)}
    />
  );
}
