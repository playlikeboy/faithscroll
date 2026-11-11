import { Pressable, StyleSheet, View, type AccessibilityActionEvent } from 'react-native';

import { FaithText } from '@/components/ui';
import { scriptureSizeLabel } from '@/features/settings/scripture-size';
import { MIN_TOUCH_TARGET, SCRIPTURE_SIZES, useTheme } from '@/theme';

export interface ScriptureSizeControlProps {
  sizeIndex: number;
  onChange: (index: number) => void;
}

const LAST_INDEX = SCRIPTURE_SIZES.length - 1;

/** Stepped text-size control: A− / track / A+, adjustable by swipe for VoiceOver users. */
export function ScriptureSizeControl({ sizeIndex, onChange }: ScriptureSizeControlProps) {
  const { colors, fonts } = useTheme();
  const label = scriptureSizeLabel(sizeIndex);
  const canShrink = sizeIndex > 0;
  const canGrow = sizeIndex < LAST_INDEX;

  const step = (delta: number) => onChange(Math.min(LAST_INDEX, Math.max(0, sizeIndex + delta)));
  const handleAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') step(1);
    if (event.nativeEvent.actionName === 'decrement') step(-1);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Smaller text"
          accessibilityState={{ disabled: !canShrink }}
          disabled={!canShrink}
          onPress={() => step(-1)}
          style={[styles.end, !canShrink && styles.disabled]}>
          <FaithText style={{ fontFamily: fonts.serif, fontSize: 15, color: colors.primaryText }}>A</FaithText>
        </Pressable>

        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Scripture text size"
          accessibilityValue={{ text: label }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={handleAction}
          style={styles.track}>
          {SCRIPTURE_SIZES.map((size, index) => {
            const isCurrent = index === sizeIndex;
            return (
              <Pressable key={size} onPress={() => onChange(index)} hitSlop={6} style={styles.stop}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: index <= sizeIndex ? colors.primaryText : colors.border,
                      transform: [{ scale: isCurrent ? 1.6 : 1 }],
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Larger text"
          accessibilityState={{ disabled: !canGrow }}
          disabled={!canGrow}
          onPress={() => step(1)}
          style={[styles.end, !canGrow && styles.disabled]}>
          <FaithText style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.primaryText }}>A</FaithText>
        </Pressable>
      </View>
      <FaithText variant="secondary" align="center" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  end: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  track: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  stop: { minWidth: 28, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
