/** The live recording screen (container): timer, meter, controls, bookmarks and notes. */
import { usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookmarkCaptureCard } from '@/components/sermons/bookmark-capture-card';
import { NotesPanel } from '@/components/sermons/notes-panel';
import { RecordingControls } from '@/components/sermons/recording-controls';
import { RecordingIndicator, type IndicatorState } from '@/components/sermons/recording-indicator';
import { RecordingWaveform } from '@/components/sermons/recording-waveform';
import { Card, FaithText, Icon, IconButton } from '@/components/ui';
import { spokenDuration } from '@/features/editor';
import { sermonHref } from '@/features/sermons/routes';
import { useSermonNotesDraft } from '@/features/sermons/use-sermon-notes-draft';
import { usePickPassage } from '@/features/sermons/use-pick-passage';
import { formatDuration } from '@/lib/time';
import { GUTTER, MIN_TOUCH_TARGET, tabularNums, useTheme } from '@/theme';

import type { SessionSnapshot } from './recording-session';
import { useBookmarkCapture } from './use-bookmark-capture';
import { useSermonRecorder } from './use-sermon-recorder';

export interface RecorderScreenProps {
  sermonId: string;
  title: string;
  /** Opened from "New sermon": go to the sermon page afterwards instead of back. */
  returnToDetail: boolean;
}

const SYSTEM_INTERRUPTION =
  'Recording paused because your phone needed the microphone (a call or Siri). Everything so far is saved — tap Resume when you’re ready.';

function indicatorState(snapshot: SessionSnapshot): IndicatorState {
  switch (snapshot.phase) {
    case 'recording':
      return 'recording';
    case 'paused':
      return 'paused';
    case 'interrupted':
      return 'interrupted';
    case 'saved':
      return 'saved';
    default:
      return 'ready';
  }
}

function statusMessage(snapshot: SessionSnapshot): string | null {
  if (snapshot.errorMessage) return snapshot.errorMessage;
  if (snapshot.phase === 'interrupted' && snapshot.interruption === 'system') return SYSTEM_INTERRUPTION;
  if (snapshot.phase === 'paused') return 'Paused. Everything so far is saved on this device.';
  return null;
}

export function RecorderScreen({ sermonId, title, returnToDetail }: RecorderScreenProps) {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const recorder = useSermonRecorder(sermonId);
  const { snapshot } = recorder;
  const notes = useSermonNotesDraft(sermonId);
  const bookmarks = useBookmarkCapture(sermonId, recorder.captureBookmark);
  const pickPassage = usePickPassage('Scripture reference');
  const [isFinishing, setIsFinishing] = useState(false);

  const hasAudio = snapshot.savedPartIds.length > 0 || snapshot.currentPartId !== null;
  const isActive = ['recording', 'paused', 'interrupted'].includes(snapshot.phase) || (snapshot.phase === 'starting' && hasAudio);

  const allowRemovalRef = useRef<() => void>(() => undefined);

  const leave = () => {
    allowRemovalRef.current();
    if (returnToDetail) router.replace(sermonHref(sermonId));
    else router.back();
  };

  const finish = async () => {
    setIsFinishing(true);
    await recorder.stop();
    await notes.flush();
    leave();
  };

  const confirmStop = () => {
    Alert.alert('Stop and save this recording?', 'Your recording, bookmarks and notes stay on this device.', [
      { text: 'Keep recording', style: 'cancel' },
      { text: 'Stop & Save', style: 'destructive', onPress: () => void finish() },
    ]);
  };

  // Never lose a recording to a back gesture or the Android back button: ask to stop & save first.
  const allowRemoval = usePreventRemove(isActive && !isFinishing, confirmStop);
  useEffect(() => {
    allowRemovalRef.current = allowRemoval;
  }, [allowRemoval]);

  const close = () => {
    if (isActive) {
      confirmStop();
      return;
    }
    void notes.flush().then(leave);
  };

  const message = statusMessage(snapshot);
  const showStart = snapshot.phase === 'idle' || snapshot.phase === 'error' || (snapshot.phase === 'starting' && !hasAudio);
  const controlsPhase = snapshot.phase === 'recording' || snapshot.phase === 'paused' || snapshot.phase === 'interrupted' ? snapshot.phase : 'starting';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <View style={styles.topBar}>
          <IconButton icon="close" accessibilityLabel={isActive ? 'Stop and save recording' : 'Close'} onPress={close} />
          <RecordingIndicator state={indicatorState(snapshot)} />
          <View style={styles.topBarSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <FaithText variant="secondary" align="center" numberOfLines={2}>
            {title}
          </FaithText>
          <FaithText
            accessibilityRole="timer"
            accessibilityLabel={`Elapsed ${spokenDuration(snapshot.elapsedMs)}`}
            align="center"
            style={[styles.elapsed, { fontFamily: fonts.sans, color: colors.text }, tabularNums]}>
            {formatDuration(snapshot.elapsedMs)}
          </FaithText>
          <RecordingWaveform levels={recorder.levels} isActive={snapshot.phase === 'recording'} />

          {message ? (
            <Card tone="muted">
              <FaithText variant="secondary" accessibilityLiveRegion="polite" color={snapshot.errorMessage ? 'danger' : 'textSecondary'}>
                {message}
              </FaithText>
            </Card>
          ) : null}
          {bookmarks.error ? (
            <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
              {bookmarks.error}
            </FaithText>
          ) : null}
          {bookmarks.captured ? (
            <BookmarkCaptureCard
              key={bookmarks.captured.id}
              bookmark={bookmarks.captured}
              onSaveNote={bookmarks.saveNote}
              onAddReference={() => void bookmarks.addReference()}
              onDismiss={bookmarks.dismiss}
            />
          ) : null}

          <NotesPanel
            value={notes.content}
            onChangeText={notes.setContent}
            status={notes.status}
            onBlur={() => void notes.flush()}
            getTimestampMs={recorder.currentPositionMs}
            onRequestScripture={async () => (await pickPassage(null))?.text ?? null}
          />
        </ScrollView>

        <View style={[styles.bottom, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {showStart ? (
            <StartButton isStarting={snapshot.phase === 'starting'} isRetry={snapshot.phase === 'error'} onPress={() => void recorder.start()} />
          ) : (
            <RecordingControls
              phase={isFinishing ? 'starting' : controlsPhase}
              canBookmark={hasAudio && !isFinishing}
              onPause={() => void recorder.pause()}
              onResume={() => void recorder.resume()}
              onBookmark={bookmarks.capture}
              onStop={confirmStop}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StartButton({ isStarting, isRetry, onPress }: { isStarting: boolean; isRetry: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const label = isStarting ? 'Starting…' : isRetry ? 'Try again' : 'Start recording';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Starts recording with the microphone"
      accessibilityState={{ disabled: isStarting, busy: isStarting }}
      disabled={isStarting}
      onPress={onPress}
      style={({ pressed }) => [styles.start, { backgroundColor: colors.recording, opacity: isStarting ? 0.6 : pressed ? 0.85 : 1 }]}>
      <Icon name="record" size={26} color={colors.background} />
      <FaithText variant="heading" style={{ color: colors.background }}>
        {label}
      </FaithText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER - 8, paddingTop: 4 },
  topBarSpacer: { width: MIN_TOUCH_TARGET },
  content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 32, gap: 16 },
  elapsed: { fontSize: 60, lineHeight: 70, fontWeight: '300', letterSpacing: 1 },
  bottom: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  start: {
    minHeight: MIN_TOUCH_TARGET + 20,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
});
