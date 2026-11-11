import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card, EmptyState, FaithButton, FaithText } from '@/components/ui';
import type { TranscriptionPhase } from '@/features/transcription/phase';
import type { TranscriptionGate } from '@/features/transcription/use-transcription';
import { formatDuration } from '@/lib/time';
import { aiErrorMessage, fromServerCode, needsPaywall } from '@/services/ai/errors';
import { useTheme } from '@/theme';

import { ProgressBar } from '../progress-bar';

export interface TranscriptionStatusProps {
  gate: TranscriptionGate;
  phase: TranscriptionPhase;
  partCount: number;
  durationMs: number;
  jobProgress: { done: number; total: number } | null;
  onTranscribe: () => void;
  onCancelUpload: () => void;
  onSignIn: () => void;
  onPaywall: () => void;
}

function partsLabel(partCount: number, durationMs: number): string {
  const parts = partCount === 1 ? '1 recording' : `${partCount} recording parts`;
  return `${parts} · ${formatDuration(durationMs)}`;
}

function Intro({ partCount, durationMs, onTranscribe }: Pick<TranscriptionStatusProps, 'partCount' | 'durationMs' | 'onTranscribe'>) {
  return (
    <Card style={styles.card}>
      <FaithText variant="heading">Create a transcript</FaithText>
      <FaithText variant="secondary">
        Turn your recording into timestamped text you can search and correct. Scripture mentioned is picked out automatically.
      </FaithText>
      <FaithText variant="caption">{partsLabel(partCount, durationMs)}</FaithText>
      <FaithButton label="Transcribe recording" icon="transcript" onPress={onTranscribe} accessibilityHint="Explains the upload before anything is sent" />
    </Card>
  );
}

function Failed({ errorCode, onTranscribe, onSignIn, onPaywall }: { errorCode: string } & Pick<TranscriptionStatusProps, 'onTranscribe' | 'onSignIn' | 'onPaywall'>) {
  const code = fromServerCode(errorCode);
  if (code === 'cancelled') {
    return (
      <Card style={styles.card}>
        <FaithText variant="heading">Upload cancelled</FaithText>
        <FaithText variant="secondary">Nothing was transcribed. Your recording is still on this device.</FaithText>
        <FaithButton label="Transcribe recording" icon="transcript" onPress={onTranscribe} />
      </Card>
    );
  }
  const action = needsPaywall(code)
    ? { label: 'See Faithscroll Plus', onPress: onPaywall }
    : code === 'signed_out'
      ? { label: 'Sign in', onPress: onSignIn }
      : { label: 'Try again', onPress: onTranscribe };
  return (
    <Card style={styles.card}>
      <View accessibilityLiveRegion="polite" style={styles.gap}>
        <FaithText variant="heading">The transcript wasn’t created</FaithText>
        <FaithText variant="secondary">{aiErrorMessage(code)}</FaithText>
      </View>
      <FaithButton label={action.label} onPress={action.onPress} variant="secondary" />
    </Card>
  );
}

export function TranscriptionStatus(props: TranscriptionStatusProps) {
  const { colors } = useTheme();
  const { gate, phase } = props;

  if (phase.kind === 'completed') return null;
  if (gate === 'not_configured') {
    return <EmptyState icon="cloud" title="Cloud features aren’t set up" message="Transcription needs the Faithscroll cloud service, which isn’t configured in this build." />;
  }
  if (gate === 'signed_out' && phase.kind !== 'uploading') {
    return (
      <EmptyState
        icon="person"
        title="Sign in to transcribe"
        message="Transcription runs in your private account. Your recording stays on this device until you choose to upload it."
        actionLabel="Sign in"
        onAction={props.onSignIn}
      />
    );
  }
  if (gate === 'no_recording' && phase.kind === 'idle') {
    return <EmptyState icon="waveform" title="No recording yet" message="Record this sermon, then come back to create a transcript." />;
  }

  switch (phase.kind) {
    case 'idle':
      return <Intro {...props} />;
    case 'uploading': {
      const { upload } = phase;
      const label =
        upload.phase === 'starting'
          ? 'Starting transcription…'
          : upload.partCount > 1
            ? `Uploading part ${upload.partIndex + 1} of ${upload.partCount}`
            : 'Uploading recording';
      return (
        <Card style={styles.card}>
          <FaithText variant="heading" accessibilityLiveRegion="polite">
            {label}
          </FaithText>
          <ProgressBar value={upload.fraction} label="Upload progress" />
          <FaithText variant="caption">Keep the app open until the upload finishes.</FaithText>
          {upload.phase === 'uploading' ? <FaithButton label="Cancel upload" variant="ghost" onPress={props.onCancelUpload} /> : null}
        </Card>
      );
    }
    case 'interrupted':
      return (
        <Card style={styles.card}>
          <FaithText variant="heading">Upload interrupted</FaithText>
          <FaithText variant="secondary">The app closed before the upload finished. You can pick up where it stopped.</FaithText>
          <FaithButton label="Resume upload" icon="cloud" onPress={props.onTranscribe} />
        </Card>
      );
    case 'processing': {
      const progress = props.jobProgress && props.jobProgress.total > 1 ? props.jobProgress : null;
      return (
        <Card style={styles.card}>
          <View style={styles.processing} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primaryText} />
            <FaithText variant="heading" style={styles.flex}>
              Transcribing…
            </FaithText>
          </View>
          <FaithText variant="secondary">This can take a few minutes. You can leave this screen and come back.</FaithText>
          {progress ? <ProgressBar value={progress.done / progress.total} label={`${progress.done} of ${progress.total} parts transcribed`} /> : null}
        </Card>
      );
    }
    case 'failed':
      return <Failed errorCode={phase.errorCode} {...props} />;
  }
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  gap: { gap: 6 },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
