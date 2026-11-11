import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import type { AutosaveStatus } from '@/features/editor/use-autosave';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { AutosaveIndicator } from './autosave-indicator';

export interface EditorHeaderActionsProps {
  status: AutosaveStatus;
  hasSaved: boolean;
  onDone: () => void;
}

/** Native-header right side for editors: quiet save status + Done. */
export function EditorHeaderActions({ status, hasSaved, onDone }: EditorHeaderActionsProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <AutosaveIndicator status={status} hasSaved={hasSaved} />
      <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={onDone} hitSlop={8} style={styles.done}>
        <FaithText variant="heading" style={{ color: colors.primaryText }}>
          Done
        </FaithText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  done: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
});
