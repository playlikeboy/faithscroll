import { StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { WAVEFORM_BARS } from '@/features/recording/level';
import { useTheme } from '@/theme';

import { useReduceMotion } from './use-reduce-motion';

const MIN_BAR = 4;
const MAX_BAR = 56;

export interface RecordingWaveformProps {
  /** Recent levels 0…1, oldest first. */
  levels: readonly number[];
  isActive: boolean;
}

/**
 * Live input meter built from recorder metering. With Reduce Motion (or no metering) it becomes a
 * static indicator so nothing moves constantly.
 */
export function RecordingWaveform({ levels, isActive }: RecordingWaveformProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  if (reduceMotion || levels.length === 0) {
    return (
      <View style={styles.static} accessible accessibilityLabel={isActive ? 'Microphone is listening' : 'Microphone is off'}>
        <Icon name="waveform" size={32} color={isActive ? colors.recording : colors.textTertiary} />
        <FaithText variant="secondary">{isActive ? 'Listening' : 'Not recording'}</FaithText>
      </View>
    );
  }

  const padded = [...new Array(Math.max(0, WAVEFORM_BARS - levels.length)).fill(0), ...levels];
  const color = isActive ? colors.recording : colors.textTertiary;
  return (
    <View style={styles.bars} accessible accessibilityLabel={isActive ? 'Live input level' : 'Input level, paused'}>
      {padded.map((level, index) => (
        // Bars are positional (a rolling window), so the index is the stable identity.
        <View key={index} style={[styles.bar, { height: MIN_BAR + level * (MAX_BAR - MIN_BAR), backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { height: MAX_BAR, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  bar: { width: 4, borderRadius: 2 },
  static: { height: MAX_BAR, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
});
