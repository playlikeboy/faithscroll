import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NoteRenderer } from '@/components/editor/note-renderer';
import { NotesPanel } from '@/components/sermons/notes-panel';
import { FaithButton, FaithText } from '@/components/ui';
import type { VerseRange } from '@/features/bible/types';

import { useSermonNote } from './hooks';
import { useSermonNotesDraft } from './use-sermon-notes-draft';
import { usePickPassage } from './use-pick-passage';

export interface SermonNotesSectionProps {
  sermonId: string;
  getTimestampMs: () => number | null;
  onPressTimestamp: (positionMs: number) => void;
  onPressReference: (range: VerseRange) => void;
}

function NotesEditing({ sermonId, getTimestampMs, onDone }: { sermonId: string; getTimestampMs: () => number | null; onDone: () => void }) {
  const draft = useSermonNotesDraft(sermonId);
  const pickPassage = usePickPassage('Scripture reference');
  return (
    <View style={styles.section}>
      <NotesPanel
        value={draft.content}
        onChangeText={draft.setContent}
        status={draft.status}
        autoFocus
        onBlur={() => void draft.flush()}
        getTimestampMs={getTimestampMs}
        onRequestScripture={async () => (await pickPassage(null))?.text ?? null}
      />
      <FaithButton label="Done" icon="check" variant="secondary" onPress={() => void draft.flush().then(onDone)} />
    </View>
  );
}

/** Sermon notes: rendered (tappable timestamps and references) with an Edit mode that autosaves. */
export function SermonNotesSection({ sermonId, getTimestampMs, onPressTimestamp, onPressReference }: SermonNotesSectionProps) {
  const note = useSermonNote(sermonId);
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) return <NotesEditing sermonId={sermonId} getTimestampMs={getTimestampMs} onDone={() => setIsEditing(false)} />;

  const content = note.data?.content.trim() ?? '';
  return (
    <View style={styles.section}>
      {content ? (
        <NoteRenderer content={content} onPressTimestamp={onPressTimestamp} onPressReference={onPressReference} />
      ) : (
        <FaithText variant="secondary">No notes yet. Capture key points, verses and what stood out to you.</FaithText>
      )}
      <FaithButton label={content ? 'Edit notes' : 'Add notes'} icon="edit" variant="secondary" onPress={() => setIsEditing(true)} style={styles.edit} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  edit: { alignSelf: 'flex-start' },
});
