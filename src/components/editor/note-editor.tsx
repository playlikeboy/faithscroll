/**
 * Markdown-lite note editor: a multiline TextInput plus a formatting toolbar
 * (Heading, Bold, Italic, Highlight, Bulleted list, Numbered list, and — when the matching props
 * are given — Timestamp and Scripture). Lists continue automatically on Return.
 *
 * Toolbar placement:
 * - iOS: attached to the keyboard with `InputAccessoryView`.
 * - Android: rendered at the bottom of the editor while it is focused. Give the editor
 *   `style={{ flex: 1 }}` as the last child of a keyboard-avoiding container so its bottom edge —
 *   and the toolbar — sits on top of the keyboard. Parent ScrollViews should use
 *   `keyboardShouldPersistTaps="handled"`.
 */
import { useCallback, useId, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type ViewStyle,
} from 'react-native';

import { FaithText } from '@/components/ui';
import { useNoteEditor } from '@/features/editor/use-note-editor';
import { spacing, useTheme, useThemedStyles, type Theme } from '@/theme';

import { NoteEditorToolbar } from './note-editor-toolbar';

export interface NoteEditorProps {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Accessibility label for the text area. */
  accessibilityLabel?: string;
  minHeight?: number;
  /**
   * When provided, the toolbar shows a "timestamp" button. Return the current playback/recording
   * position in ms (or null to do nothing); the editor inserts a `[mm:ss]` token.
   */
  getTimestampMs?: () => number | null;
  /** When provided, the toolbar shows a "Scripture" button that inserts the returned reference text. */
  onRequestScripture?: () => Promise<string | null>;
  /** Default true. */
  editable?: boolean;
  /** E.g. flush autosave when the editor loses focus. */
  onBlur?: () => void;
  onFocus?: () => void;
  /** Container style (use `{ flex: 1 }` for a full-height editor). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DEFAULT_MIN_HEIGHT = 160;

export function NoteEditor({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  accessibilityLabel,
  minHeight = DEFAULT_MIN_HEIGHT,
  getTimestampMs,
  onRequestScripture,
  editable = true,
  onBlur,
  onFocus,
  style,
  testID,
}: NoteEditorProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const accessoryId = `note-editor-${useId()}`;
  const inputRef = useRef<TextInputInstance>(null);
  const [isFocused, setIsFocused] = useState(false);
  const focusInput = useCallback(() => inputRef.current?.focus(), []);
  const editor = useNoteEditor({ value, onChangeText, getTimestampMs, onRequestScripture, onInserted: focusInput });

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  const toolbar = editable ? (
    <NoteEditorToolbar
      onAction={editor.runAction}
      showTimestamp={getTimestampMs !== undefined}
      showScripture={onRequestScripture !== undefined}
      isScriptureBusy={editor.isScriptureBusy}
      onDismissKeyboard={Keyboard.dismiss}
    />
  ) : null;
  const isIos = Platform.OS === 'ios';

  return (
    <View style={[styles.container, style]} testID={testID}>
      <TextInput
        ref={inputRef}
        multiline
        value={value}
        onChangeText={editor.handleChangeText}
        selection={editor.selection}
        onSelectionChange={editor.handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        autoFocus={autoFocus}
        editable={editable}
        accessibilityLabel={accessibilityLabel ?? placeholder ?? 'Note'}
        inputAccessoryViewID={isIos && toolbar ? accessoryId : undefined}
        onFocus={handleFocus}
        onBlur={handleBlur}
        textAlignVertical="top"
        autoCapitalize="sentences"
        style={[styles.input, { minHeight }]}
      />
      {editor.errorMessage ? (
        <FaithText variant="secondary" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {editor.errorMessage}
        </FaithText>
      ) : null}
      {isIos && toolbar ? (
        <InputAccessoryView nativeID={accessoryId} backgroundColor={colors.surface}>
          {toolbar}
        </InputAccessoryView>
      ) : null}
      {!isIos && isFocused ? toolbar : null}
    </View>
  );
}

const createStyles = ({ colors, fonts, fontSizes }: Theme) =>
  StyleSheet.create({
    container: { gap: spacing.sm },
    input: {
      flexGrow: 1,
      color: colors.text,
      fontFamily: fonts.sans,
      fontSize: fontSizes.body,
      lineHeight: 24,
      paddingVertical: spacing.sm,
    },
    error: { paddingHorizontal: spacing.xs },
  });
