/**
 * Formatting toolbar for `NoteEditor`. Icon-only buttons with accessibility labels, 44pt targets
 * and a light selection haptic. Taps never steal focus from the text input.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { EditorAction } from '@/features/editor/use-note-editor';
import { logger } from '@/lib/logger';
import { MIN_TOUCH_TARGET, spacing, useTheme, useThemedStyles, type Theme } from '@/theme';

interface SymbolName {
  ios: SFSymbol;
  android: AndroidSymbol;
}

interface Tool {
  action: EditorAction;
  label: string;
  hint?: string;
  icon: SymbolName;
}

const TOOLS: readonly Tool[] = [
  { action: 'heading', label: 'Heading', hint: 'Cycles through heading sizes', icon: { ios: 'textformat', android: 'title' } },
  { action: 'bold', label: 'Bold', icon: { ios: 'bold', android: 'format_bold' } },
  { action: 'italic', label: 'Italic', icon: { ios: 'italic', android: 'format_italic' } },
  { action: 'highlight', label: 'Highlight', icon: { ios: 'highlighter', android: 'ink_highlighter' } },
  { action: 'bullet', label: 'Bulleted list', icon: { ios: 'list.bullet', android: 'format_list_bulleted' } },
  { action: 'numbered', label: 'Numbered list', icon: { ios: 'list.number', android: 'format_list_numbered' } },
  { action: 'timestamp', label: 'Insert timestamp', hint: 'Adds the current time as a tappable timestamp', icon: { ios: 'clock', android: 'schedule' } },
  { action: 'scripture', label: 'Insert Scripture reference', icon: { ios: 'book', android: 'menu_book' } },
];

const DISMISS_ICON: SymbolName = { ios: 'keyboard.chevron.compact.down', android: 'keyboard_hide' };
const ICON_SIZE = 20;

function selectionHaptic(): void {
  Haptics.selectionAsync().catch((error: unknown) => {
    logger.debug('Selection haptic unavailable', { error: error instanceof Error ? error.name : typeof error });
  });
}

interface ToolButtonProps {
  label: string;
  hint?: string;
  icon: SymbolName;
  isDisabled?: boolean;
  onPress: () => void;
}

function ToolButton({ label, hint, icon, isDisabled = false, onPress }: ToolButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => {
        selectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, isDisabled && styles.disabled]}>
      <SymbolView
        name={icon}
        size={ICON_SIZE}
        tintColor={colors.text}
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

export interface NoteEditorToolbarProps {
  onAction: (action: EditorAction) => void;
  showTimestamp: boolean;
  showScripture: boolean;
  isScriptureBusy?: boolean;
  /** When given, a trailing "Hide keyboard" button is shown. */
  onDismissKeyboard?: () => void;
}

export const NoteEditorToolbar = memo(function NoteEditorToolbar({
  onAction,
  showTimestamp,
  showScripture,
  isScriptureBusy = false,
  onDismissKeyboard,
}: NoteEditorToolbarProps) {
  const styles = useThemedStyles(createStyles);
  const tools = TOOLS.filter(
    (tool) => (tool.action !== 'timestamp' || showTimestamp) && (tool.action !== 'scripture' || showScripture),
  );
  return (
    <View style={styles.bar} accessibilityRole="toolbar" accessibilityLabel="Formatting">
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tools}>
        {tools.map((tool) => (
          <ToolButton
            key={tool.action}
            label={tool.label}
            hint={tool.hint}
            icon={tool.icon}
            isDisabled={tool.action === 'scripture' && isScriptureBusy}
            onPress={() => onAction(tool.action)}
          />
        ))}
      </ScrollView>
      {onDismissKeyboard ? <ToolButton label="Hide keyboard" icon={DISMISS_ICON} onPress={onDismissKeyboard} /> : null}
    </View>
  );
});

const createStyles = ({ colors, radii }: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.xs,
    },
    tools: { alignItems: 'center', gap: spacing.xxs },
    button: {
      minWidth: MIN_TOUCH_TARGET,
      minHeight: MIN_TOUCH_TARGET,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: colors.surfaceMuted },
    disabled: { opacity: 0.4 },
    icon: { width: ICON_SIZE, height: ICON_SIZE },
  });
