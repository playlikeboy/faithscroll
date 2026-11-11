import { useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';

import { spokenDuration } from '@/features/editor';
import { SKIP_MS } from '@/features/audio/timeline';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface SeekBarProps {
  positionMs: number;
  totalMs: number;
  onSeek: (positionMs: number) => void;
  /** Called while dragging, so labels can follow the finger (null when the drag ends). */
  onScrub?: (positionMs: number | null) => void;
}

const THUMB = 16;

/**
 * Seekable progress bar (no slider package is installed): drag or tap with gesture-handler,
 * and VoiceOver/TalkBack can adjust it in 15-second steps.
 */
export function SeekBar({ positionMs, totalMs, onSeek, onScrub }: SeekBarProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const fractionAt = (x: number) => (width > 0 ? Math.min(1, Math.max(0, x / width)) : 0);
  const scrubTo = (fraction: number | null) => {
    setDragFraction(fraction);
    onScrub?.(fraction === null ? null : fraction * totalMs);
  };

  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-4, 4],
    failOffsetY: [-14, 14],
    onActivate: (event) => scrubTo(fractionAt(event.x)),
    onUpdate: (event) => {
      if ('x' in event) scrubTo(fractionAt(event.x));
    },
    onDeactivate: (event) => {
      if (!event.canceled) onSeek(fractionAt(event.x) * totalMs);
      scrubTo(null);
    },
    onFinalize: () => {
      if (dragFraction !== null) scrubTo(null);
    },
  });
  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (event) => onSeek(fractionAt(event.x) * totalMs),
  });
  const gesture = useCompetingGestures(pan, tap);

  const progress = dragFraction ?? (totalMs > 0 ? Math.min(1, positionMs / totalMs) : 0);
  const shownMs = dragFraction === null ? positionMs : dragFraction * totalMs;

  const handleAction = (event: AccessibilityActionEvent) => {
    const delta = event.nativeEvent.actionName === 'increment' ? SKIP_MS : event.nativeEvent.actionName === 'decrement' ? -SKIP_MS : 0;
    if (delta !== 0) onSeek(Math.min(totalMs, Math.max(0, positionMs + delta)));
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Playback position"
        accessibilityValue={{
          min: 0,
          max: Math.round(totalMs / 1000),
          now: Math.round(shownMs / 1000),
          text: `${spokenDuration(shownMs)} of ${spokenDuration(totalMs)}`,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={handleAction}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={styles.hitArea}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: colors.primaryText }]} />
        </View>
        <View
          style={[
            styles.thumb,
            { left: Math.max(0, progress * width - THUMB / 2), backgroundColor: colors.primaryText, borderColor: colors.surface },
            dragFraction !== null && styles.thumbActive,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hitArea: { height: MIN_TOUCH_TARGET, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 2 },
  thumbActive: { transform: [{ scale: 1.25 }] },
});
