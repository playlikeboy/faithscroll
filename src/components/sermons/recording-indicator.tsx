import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { useTheme } from '@/theme';

import { useReduceMotion } from './use-reduce-motion';

export type IndicatorState = 'ready' | 'recording' | 'paused' | 'interrupted' | 'saved';

const LABELS: Record<IndicatorState, string> = {
  ready: 'Ready to record',
  recording: 'Recording',
  paused: 'Paused',
  interrupted: 'Paused — interrupted',
  saved: 'Saved',
};

/** Obvious recording state: a red dot (gently pulsing unless Reduce Motion) plus a text label. */
export function RecordingIndicator({ state }: { state: IndicatorState }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const isLive = state === 'recording';

  useEffect(() => {
    if (!isLive || reduceMotion) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, reduceMotion, opacity]);

  const dotColor = isLive ? colors.recording : state === 'saved' ? colors.primaryText : colors.textTertiary;

  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={LABELS[state]} accessibilityLiveRegion="polite">
      <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity }]} />
      <FaithText variant="label" style={{ color: isLive ? colors.recording : colors.textSecondary }}>
        {LABELS[state]}
      </FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
