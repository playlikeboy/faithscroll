/**
 * CONTRACT STUB — owned by the editor agent.
 * Lightweight Markdown-lite rich text editor with a formatting toolbar.
 */
import { TextInput } from 'react-native';

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
}

export function NoteEditor({ value, onChangeText, placeholder, autoFocus, accessibilityLabel }: NoteEditorProps) {
  return (
    <TextInput
      multiline
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoFocus={autoFocus}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
