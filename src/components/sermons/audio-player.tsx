import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, FaithText, Icon, IconButton } from '@/components/ui';
import { formatRate, SKIP_MS } from '@/features/audio/timeline';
import { formatDuration } from '@/lib/time';
import { MIN_TOUCH_TARGET, tabularNums, useTheme } from '@/theme';

import { SeekBar } from './seek-bar';

export interface AudioPlayerProps {
  positionMs: number;
  totalMs: number;
  isPlaying: boolean;
  isBuffering?: boolean;
  rate: number;
  /** e.g. "Part 2 of 3", shown when the recording has several parts. */
  partLabel?: string | null;
  onTogglePlay: () => void;
  onSkip: (deltaMs: number) => void;
  onSeek: (positionMs: number) => void;
  onCycleRate: () => void;
}

/** Sermon audio player: play/pause, ±15 s, speed 0.75–2×, seekable progress, tabular times. */
export function AudioPlayer({
  positionMs,
  totalMs,
  isPlaying,
  isBuffering = false,
  rate,
  partLabel,
  onTogglePlay,
  onSkip,
  onSeek,
  onCycleRate,
}: AudioPlayerProps) {
  const { colors, radii } = useTheme();
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const shownMs = scrubMs ?? positionMs;

  return (
    <Card>
      <View style={styles.body}>
        <SeekBar positionMs={positionMs} totalMs={totalMs} onSeek={onSeek} onScrub={setScrubMs} />
        <View style={styles.times}>
          <FaithText variant="caption" style={tabularNums} accessibilityLabel={`Current time ${formatDuration(shownMs)}`}>
            {formatDuration(shownMs)}
          </FaithText>
          {partLabel ? <FaithText variant="caption">{partLabel}</FaithText> : null}
          <FaithText variant="caption" style={tabularNums} accessibilityLabel={`Duration ${formatDuration(totalMs)}`}>
            {formatDuration(totalMs)}
          </FaithText>
        </View>
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${formatRate(rate)}`}
            accessibilityHint="Changes the playback speed"
            onPress={onCycleRate}
            hitSlop={6}
            style={({ pressed }) => [styles.rate, { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, opacity: pressed ? 0.7 : 1 }]}>
            <FaithText variant="secondary" weight="600" style={tabularNums}>
              {formatRate(rate)}
            </FaithText>
          </Pressable>
          <IconButton icon="skipBack" accessibilityLabel="Back 15 seconds" onPress={() => onSkip(-SKIP_MS)} size={26} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityState={{ busy: isBuffering }}
            onPress={onTogglePlay}
            style={({ pressed }) => [styles.play, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={28} color={colors.onPrimary} />
          </Pressable>
          <IconButton icon="skipForward" accessibilityLabel="Forward 15 seconds" onPress={() => onSkip(SKIP_MS)} size={26} />
          <View style={styles.rateSpacer} />
        </View>
      </View>
    </Card>
  );
}

const PLAY_SIZE = 64;

const styles = StyleSheet.create({
  body: { gap: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  rate: { minWidth: 56, minHeight: MIN_TOUCH_TARGET - 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  rateSpacer: { minWidth: 56 },
  play: { width: PLAY_SIZE, height: PLAY_SIZE, borderRadius: PLAY_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
});
