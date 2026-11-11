/**
 * Transcript screen (PRD §6.3F): consent → upload → processing → timestamped, correctable transcript
 * with detected Scripture. Tapping a line opens the sermon at that moment.
 */
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, FaithButton, FaithText, Section } from '@/components/ui';
import { summarizeReferences } from '@/features/transcription/detect-references';
import type { SegmentRow as SegmentRecord } from '@/features/transcription/repository';
import { useTranscription } from '@/features/transcription/use-transcription';
import { formatDuration } from '@/lib/time';
import { aiErrorMessage, needsPaywall, toAiServiceError } from '@/services/ai/errors';
import { usePreferences } from '@/stores/preferences';
import { GUTTER, useTheme } from '@/theme';

import { AiConsentSheet } from '../ai-consent-sheet';
import { AiLabel } from '../ai-label';
import { aiRoutes } from '../ai-routes';
import { ScriptureChips } from '../scripture-chips';
import { SegmentRow } from './segment-row';
import { TranscriptionStatus } from './transcription-status';

export interface TranscriptScreenProps {
  sermonId: string;
}

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

export function TranscriptScreen({ sermonId }: TranscriptScreenProps) {
  const { colors } = useTheme();
  const transcription = useTranscription(sermonId);
  const consentAt = usePreferences((state) => state.aiProcessingConsentAt);
  const acknowledgeConsent = usePreferences((state) => state.acknowledgeAiProcessingConsent);
  const [isConsentVisible, setConsentVisible] = useState(false);
  const { phase, segments, approximateTimestamps } = transcription;
  const isCompleted = phase.kind === 'completed';

  const chips = useMemo(
    () =>
      summarizeReferences(transcription.references).map((ref) => ({
        key: `${ref.startVerseId}-${ref.endVerseId}`,
        referenceText: ref.referenceText,
        startVerseId: ref.startVerseId,
        positionMs: ref.positionsMs[0] ?? null,
      })),
    [transcription.references],
  );

  const handleSeek = useCallback((positionMs: number) => router.push(aiRoutes.sermonAt(sermonId, positionMs)), [sermonId]);
  const { saveSegment, start } = transcription;

  const runTranscription = useCallback(async () => {
    const code = await start();
    if (code && needsPaywall(code)) router.push(aiRoutes.paywall('transcription'));
  }, [start]);

  const handleConfirmConsent = () => {
    setConsentVisible(false);
    if (!consentAt) acknowledgeConsent();
    void runTranscription();
  };

  const handleTranscribe = () => {
    // An interrupted upload resumes without asking again: the user already confirmed it.
    if (phase.kind === 'interrupted') void runTranscription();
    else setConsentVisible(true);
  };

  const handleDeleteCloud = () =>
    confirm('Delete cloud audio?', 'The uploaded copy is removed from your account. Your recording stays on this device.', 'Delete', () => {
      transcription.deleteCloudAudio().catch((error: unknown) => Alert.alert('Couldn’t delete the cloud audio', aiErrorMessage(toAiServiceError(error).code)));
    });

  const handleDeleteTranscript = () =>
    confirm('Delete transcript?', 'The transcript and the Scripture detected in it are removed. Your recording is not affected.', 'Delete', transcription.removeTranscript);

  const header = (
    <View style={styles.header}>
      <TranscriptionStatus
        gate={transcription.gate}
        phase={phase}
        partCount={transcription.partCount}
        durationMs={transcription.durationMs}
        jobProgress={transcription.jobProgress}
        onTranscribe={handleTranscribe}
        onCancelUpload={transcription.cancelUpload}
        onSignIn={() => router.push(aiRoutes.signIn())}
        onPaywall={() => router.push(aiRoutes.paywall('transcription'))}
      />
      {isCompleted ? (
        <Card tone="ai" style={styles.aiCard}>
          <AiLabel text="AI-generated from your recording" />
          <FaithText variant="secondary">
            {approximateTimestamps
              ? 'Times marked ≈ are estimates. Tap a line to play from about that moment, or the pencil to correct it.'
              : 'Tap a line to play from that moment, or the pencil to correct it. Transcripts can contain mistakes.'}
          </FaithText>
        </Card>
      ) : null}
      {isCompleted && chips.length > 0 ? (
        <Section title="Scripture mentioned">
          <ScriptureChips items={chips} onOpen={(item) => router.push(aiRoutes.bibleAt(item.startVerseId))} />
        </Section>
      ) : null}
      {isCompleted ? <FaithText variant="label" style={styles.transcriptLabel}>Transcript</FaithText> : null}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {isCompleted ? <FaithButton label="Generate recap" icon="sparkles" onPress={() => router.push(aiRoutes.recap(sermonId))} /> : null}
      {transcription.cloudCopyCount > 0 && phase.kind !== 'uploading' ? (
        <FaithButton label="Delete cloud audio" icon="cloud" variant="destructive" onPress={handleDeleteCloud} />
      ) : null}
      {transcription.transcript && phase.kind !== 'uploading' && phase.kind !== 'processing' ? (
        <FaithButton label="Delete transcript" icon="trash" variant="destructive" onPress={handleDeleteTranscript} />
      ) : null}
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: SegmentRecord }) => (
      <SegmentRow id={item.id} startMs={item.startMs} text={item.text} approximate={approximateTimestamps} onSeek={handleSeek} onSave={saveSegment} />
    ),
    [approximateTimestamps, handleSeek, saveSegment],
  );

  return (
    <SafeAreaView edges={[]} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={isCompleted ? segments : []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={isCompleted ? <FaithText variant="secondary">No speech was found in this recording.</FaithText> : undefined}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        windowSize={11}
      />
      <AiConsentSheet
        visible={isConsentVisible}
        firstTime={!consentAt}
        partCount={transcription.partCount}
        durationLabel={formatDuration(transcription.durationMs)}
        onConfirm={handleConfirmConsent}
        onCancel={() => setConsentVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  header: { gap: 16, paddingTop: 12, paddingBottom: 8 },
  aiCard: { gap: 8 },
  transcriptLabel: { marginTop: 8 },
  footer: { gap: 10, marginTop: 28 },
});
