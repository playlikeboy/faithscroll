import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FaithText, IconButton } from '@/components/ui';
import { GUTTER, MIN_TOUCH_TARGET, useTheme, useThemedStyles, type Theme } from '@/theme';

export interface OnboardingChromeProps {
  stepIndex: number;
  stepCount: number;
  onBack?: () => void;
  onSkip?: () => void;
  footer: ReactNode;
  children: ReactNode;
}

/** Shared frame for every onboarding step: back / progress / skip, scrollable body, pinned actions. */
export function OnboardingChrome({ stepIndex, stepCount, onBack, onSkip, footer, children }: OnboardingChromeProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const progressLabel = `Step ${stepIndex + 1} of ${stepCount}`;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.side}>
          {onBack ? <IconButton icon="back" accessibilityLabel="Back" onPress={onBack} /> : null}
        </View>
        <View style={styles.progress} accessible accessibilityLabel={progressLabel}>
          {Array.from({ length: stepCount }, (_, index) => (
            <View
              key={index}
              style={[styles.dot, { backgroundColor: index <= stepIndex ? colors.primaryText : colors.border }]}
            />
          ))}
        </View>
        <View style={[styles.side, styles.sideRight]}>
          {onSkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip"
              accessibilityHint="Continues without choosing"
              onPress={onSkip}
              hitSlop={8}
              style={styles.skip}>
              <FaithText variant="secondary" weight="600" color="primaryText">
                Skip
              </FaithText>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  );
}

function createStyles({ colors }: Theme) {
  return {
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: GUTTER - 8,
      minHeight: MIN_TOUCH_TARGET + 8,
    },
    side: { width: 72, flexDirection: 'row' as const },
    sideRight: { justifyContent: 'flex-end' as const },
    progress: { flex: 1, flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    skip: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' as const, paddingHorizontal: 8 },
    body: { flexGrow: 1, paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 24 },
    footer: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 12, gap: 8 },
  };
}
