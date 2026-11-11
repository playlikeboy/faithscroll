import { View } from 'react-native';

import { Divider, ListRow } from '@/components/ui';
import type { AiStatus } from '@/features/sermons/types';

import { aiStatusLabel } from './status-badge';

export interface SermonAiEntriesProps {
  transcriptStatus: AiStatus | null;
  recapStatus: AiStatus | null;
  hasRecording: boolean;
  onOpenTranscript: () => void;
  onOpenRecap: () => void;
}

function transcriptSubtitle(status: AiStatus | null, hasRecording: boolean): string {
  if (status) return aiStatusLabel(status);
  return hasRecording ? 'Optional — uses cloud processing only if you choose' : 'Record the sermon to transcribe it';
}

/** Entries to the AI transcript and recap screens, with their local status. */
export function SermonAiEntries({ transcriptStatus, recapStatus, hasRecording, onOpenTranscript, onOpenRecap }: SermonAiEntriesProps) {
  return (
    <View>
      <ListRow icon="transcript" title="Transcript" subtitle={transcriptSubtitle(transcriptStatus, hasRecording)} onPress={onOpenTranscript} />
      <Divider />
      <ListRow
        icon="sparkles"
        title="Recap"
        subtitle={recapStatus ? aiStatusLabel(recapStatus) : 'Summary, key points and ways to live it out'}
        onPress={onOpenRecap}
      />
    </View>
  );
}
