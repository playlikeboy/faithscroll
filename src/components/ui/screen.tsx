import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { GUTTER, useTheme } from '@/theme';

import { FaithText } from './text';

export interface ScreenProps {
  children: ReactNode;
  /** Large editorial serif title rendered at the top of the content. */
  title?: string;
  /** Small text above the title (e.g. the date). */
  eyebrow?: string;
  /** Controls rendered to the right of the title (e.g. IconButtons). */
  headerRight?: ReactNode;
  /** Wrap content in a ScrollView (default true). Use false when the screen renders its own FlatList. */
  scroll?: boolean;
  /** Safe-area edges to pad. Tab screens: ['top']; stack screens with a native header: []. */
  edges?: Edge[];
  contentPadding?: boolean;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
}

export function Screen({
  children,
  title,
  eyebrow,
  headerRight,
  scroll = true,
  edges = ['top'],
  contentPadding = true,
  keyboardShouldPersistTaps = 'handled',
}: ScreenProps) {
  const { colors } = useTheme();
  const header =
    title || headerRight ? (
      <View style={styles.header}>
        <View style={styles.headerText}>
          {eyebrow ? <FaithText variant="label">{eyebrow}</FaithText> : null}
          {title ? (
            <FaithText variant="display" accessibilityRole="header">
              {title}
            </FaithText>
          ) : null}
        </View>
        {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
      </View>
    ) : null;

  const padding = contentPadding ? styles.padded : undefined;

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, styles.scrollContent]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          contentInsetAdjustmentBehavior="automatic">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, padding]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: GUTTER },
  scrollContent: { paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 12, paddingBottom: 20, gap: 12 },
  headerText: { flex: 1, gap: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
});
