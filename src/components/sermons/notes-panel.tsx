import { StyleSheet, View } from 'react-native';

import { NoteEditor } from '@/components/editor/note-editor';
import { FaithText } from '@/components/ui';
import type { AutosaveStatus } from '@/features/editor';

export function autosaveLabel(status: AutosaveStatus): string | null {
  switch (status) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved on this device';
    case 'error':
      return 'Couldn’t save yet — we’ll keep trying';
    case 'idle':
      return null;
  }
}

export interface NotesPanelProps {
  value: string;
  onChangeText: (next: string) => void;
  status: AutosaveStatus;
  getTimestampMs?: () => number | null;
  onRequestScripture?: () => Promise<string | null>;
  placeholder?: string;
  autoFocus?: boolean;
  /** E.g. flush autosave when the editor loses focus. */
  onBlur?: () => void;
}

/** Sermon notes editor with a quiet autosave status. */
export function NotesPanel({ value, onChangeText, status, getTimestampMs, onRequestScripture, placeholder, autoFocus, onBlur }: NotesPanelProps) {
  const label = autosaveLabel(status);
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <FaithText variant="label">Notes</FaithText>
        {label ? (
          <FaithText variant="caption" color={status === 'error' ? 'danger' : 'textSecondary'} accessibilityLiveRegion="polite">
            {label}
          </FaithText>
        ) : null}
      </View>
      <NoteEditor
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? 'Key points, verses, what stood out…'}
        accessibilityLabel="Sermon notes"
        minHeight={220}
        autoFocus={autoFocus}
        getTimestampMs={getTimestampMs}
        onRequestScripture={onRequestScripture}
        onBlur={onBlur}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
