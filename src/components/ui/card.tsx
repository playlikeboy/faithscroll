import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** 'surface' (white card), 'muted' (sand), 'ai' (marks AI-generated content). */
  tone?: 'surface' | 'muted' | 'ai';
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, accessibilityLabel, accessibilityHint, tone = 'surface', style }: CardProps) {
  const { colors, radii } = useTheme();
  const background = tone === 'muted' ? colors.surfaceMuted : tone === 'ai' ? colors.aiSurface : colors.surface;
  const base = [styles.card, { backgroundColor: background, borderColor: colors.border, borderRadius: radii.lg }, style];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
