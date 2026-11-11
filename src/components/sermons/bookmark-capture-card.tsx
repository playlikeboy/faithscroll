import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Chip, FaithButton, FaithText, IconButton, TextField } from '@/components/ui';
import { formatDuration } from '@/lib/time';
import { tabularNums } from '@/theme';

export interface CapturedBookmark {
  id: string;
  elapsedMs: number;
  note: string | null;
  reference: string | null;
}

export interface BookmarkCaptureCardProps {
  bookmark: CapturedBookmark;
  onSaveNote: (note: string) => void;
  onAddReference: () => void;
  onDismiss: () => void;
}

/** Confirmation after tapping Bookmark, with an optional quick note and Bible reference. */
export function BookmarkCaptureCard({ bookmark, onSaveNote, onAddReference, onDismiss }: BookmarkCaptureCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(bookmark.note ?? '');
  const time = formatDuration(bookmark.elapsedMs);

  const save = () => {
    onSaveNote(draft);
    setIsEditing(false);
  };

  return (
    <Card tone="muted">
      <View style={styles.header} accessibilityLiveRegion="polite">
        <FaithText variant="heading" style={styles.title}>
          Bookmarked at <FaithText variant="heading" style={tabularNums}>{time}</FaithText>
        </FaithText>
        <IconButton icon="close" accessibilityLabel="Close bookmark details" onPress={onDismiss} size={18} />
      </View>
      {bookmark.note && !isEditing ? <FaithText variant="body">{bookmark.note}</FaithText> : null}
      {isEditing ? (
        <View style={styles.editor}>
          <TextField
            label="Quick note"
            value={draft}
            onChangeText={setDraft}
            placeholder="What stood out?"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <FaithButton label="Save note" variant="secondary" onPress={save} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Chip label={bookmark.note ? 'Edit note' : 'Add a note'} icon="note" onPress={() => setIsEditing(true)} />
          <Chip label={bookmark.reference ?? 'Add a verse'} icon="bible" onPress={onAddReference} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1 },
  editor: { gap: 10, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
