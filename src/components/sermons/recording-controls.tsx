import { Pressable, StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, Icon } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface RecordingControlsProps {
  phase: 'recording' | 'paused' | 'interrupted' | 'starting';
  canBookmark: boolean;
  onPause: () => void;
  onResume: () => void;
  onBookmark: () => void;
  onStop: () => void;
}

/** Persistent bottom controls: Pause/Resume, a large Bookmark button and an accessible Stop & Save. */
export function RecordingControls({ phase, canBookmark, onPause, onResume, onBookmark, onStop }: RecordingControlsProps) {
  const { colors, radii } = useTheme();
  const isRecording = phase === 'recording';
  const isBusy = phase === 'starting';

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bookmark this moment"
        accessibilityHint="Saves the current time so you can return to it"
        accessibilityState={{ disabled: !canBookmark }}
        disabled={!canBookmark}
        onPress={onBookmark}
        style={({ pressed }) => [
          styles.bookmark,
          { backgroundColor: colors.primary, borderRadius: radii.lg, opacity: !canBookmark ? 0.5 : pressed ? 0.85 : 1 },
        ]}>
        <Icon name="bookmarkFilled" size={24} color={colors.onPrimary} />
        <FaithText variant="heading" style={{ color: colors.onPrimary }}>
          Bookmark
        </FaithText>
      </Pressable>
      <View style={styles.row}>
        <FaithButton
          label={isRecording ? 'Pause' : 'Resume'}
          icon={isRecording ? 'pause' : 'record'}
          variant="secondary"
          isDisabled={isBusy}
          onPress={isRecording ? onPause : onResume}
          style={styles.flex}
        />
        <FaithButton
          label="Stop & Save"
          icon="stop"
          variant="destructive"
          isDisabled={isBusy}
          onPress={onStop}
          accessibilityHint="Asks to confirm, then saves the recording"
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 10 },
  bookmark: {
    minHeight: MIN_TOUCH_TARGET + 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
