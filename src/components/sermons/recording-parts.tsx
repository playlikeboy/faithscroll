import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, IconButton, TextField } from '@/components/ui';
import { partLabel } from '@/features/sermons/format';
import type { RecordingStatus } from '@/features/sermons/types';
import { formatDuration } from '@/lib/time';
import { tabularNums, useTheme } from '@/theme';

export interface RecordingPartItem {
  id: string;
  title: string | null;
  durationMs: number;
  status: RecordingStatus;
  /** False when the audio file is missing from this device. */
  hasFile: boolean;
}

export interface RecordingPartsProps {
  parts: readonly RecordingPartItem[];
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function statusNote(part: RecordingPartItem): string | null {
  if (part.status === 'failed') return 'Couldn’t be recovered';
  if (!part.hasFile) return 'Audio file missing';
  if (part.status === 'interrupted') return 'Recovered after an interruption';
  if (part.status === 'recording' || part.status === 'paused') return 'Still recording';
  return null;
}

function PartRow({ part, index, onRename, onDelete }: { part: RecordingPartItem; index: number } & Omit<RecordingPartsProps, 'parts'>) {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(part.title ?? '');
  const label = partLabel(part, index);
  const note = statusNote(part);

  const confirmDelete = () =>
    Alert.alert(`Delete “${label}”?`, 'The audio is removed from this device. Bookmarks in this part are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(part.id) },
    ]);

  if (isEditing) {
    const save = () => {
      onRename(part.id, draft);
      setIsEditing(false);
    };
    return (
      <View style={styles.editing}>
        <TextField label={`Rename ${label}`} value={draft} onChangeText={setDraft} autoFocus returnKeyType="done" onSubmitEditing={save} placeholder={`Part ${index + 1}`} />
        <View style={styles.editActions}>
          <FaithButton label="Save" variant="secondary" onPress={save} />
          <FaithButton label="Cancel" variant="ghost" onPress={() => setIsEditing(false)} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.text}>
        <FaithText variant="body">{label}</FaithText>
        <FaithText variant="caption" style={tabularNums}>
          {[formatDuration(part.durationMs), note].filter(Boolean).join(' · ')}
        </FaithText>
      </View>
      <IconButton icon="edit" accessibilityLabel={`Rename ${label}`} onPress={() => setIsEditing(true)} size={18} />
      <IconButton icon="trash" accessibilityLabel={`Delete ${label}`} onPress={confirmDelete} size={18} />
    </View>
  );
}

/** Recording parts (each pause or checkpoint starts a new part) with rename and delete. */
export function RecordingParts({ parts, onRename, onDelete }: RecordingPartsProps) {
  return (
    <View style={styles.list}>
      {parts.map((part, index) => (
        <PartRow key={part.id} part={part} index={index} onRename={onRename} onDelete={onDelete} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  editing: { gap: 8, paddingVertical: 8 },
  editActions: { flexDirection: 'row', gap: 8 },
});
