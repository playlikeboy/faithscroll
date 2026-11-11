import { router, Stack, type Href } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { NoteEditor } from '@/components/editor/note-editor';
import { EmptyState, FaithText, IconButton, LoadingState } from '@/components/ui';
import type { VerseNoteRow } from '@/features/bible/annotations/verse-notes';
import { useVerses } from '@/features/bible/hooks/use-bible-text';
import { useVerseNote } from '@/features/bible/hooks/use-verse-note';
import { rangeLabel } from '@/features/bible/reader/format';
import { bibleRoutes } from '@/features/bible/reader/routes';
import { useVerseNoteEditing } from '@/features/bible/reader/use-verse-note-editing';
import { DEFAULT_TRANSLATION } from '@/features/bible/repository';
import { usePassagePicker } from '@/features/bible/use-passage-picker';
import { idsToRange } from '@/features/bible/verse-id';
import type { AutosaveStatus } from '@/features/editor/use-autosave';
import { GUTTER, useTheme } from '@/theme';

import { ScriptureCard } from './scripture-card';

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  idle: 'Saved on this device',
  saving: 'Saving…',
  saved: 'Saved on this device',
  error: 'Couldn’t save yet. Your words are still here; we’ll keep trying.',
};

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/bible' as Href);
}

function NoteEditorBody({ note }: { note: VerseNoteRow }) {
  const { colors } = useTheme();
  const range = idsToRange(note.startVerseId, note.endVerseId);
  const reference = rangeLabel(range);
  const verses = useVerses(range);
  const editing = useVerseNoteEditing(note.id, note.content);
  const pickPassage = usePassagePicker();

  const confirmDelete = () =>
    Alert.alert('Delete this note?', 'This removes the note from this device and, if you sync, your other devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editing.remove()) goBack();
        },
      },
    ]);

  const requestScripture = async () => {
    const picked = await pickPassage({ title: 'Insert Scripture' });
    return picked ? rangeLabel(picked) : null;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Note',
          headerRight: () => <IconButton icon="trash" accessibilityLabel="Delete note" onPress={confirmDelete} />,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic">
        {verses.data && verses.data.length > 0 ? (
          <ScriptureCard
            reference={reference}
            verses={verses.data}
            translationLabel={DEFAULT_TRANSLATION.abbreviation}
            fontSize={17}
            numberOfLines={6}
            onPress={() => router.push(bibleRoutes.reader(range.start.bookId, range.start.chapter, range.start.verse))}
            accessibilityHint="Opens this passage in the reader"
          />
        ) : (
          <FaithText variant="title">{reference}</FaithText>
        )}
        <NoteEditor
          value={editing.content}
          onChangeText={editing.setContent}
          placeholder="What is this passage saying to you?"
          autoFocus={!note.content}
          accessibilityLabel={`Note on ${reference}`}
          minHeight={220}
          onRequestScripture={requestScripture}
        />
        <View accessibilityLiveRegion="polite">
          <FaithText variant="caption" color={editing.status === 'error' ? 'danger' : 'textSecondary'}>
            {STATUS_TEXT[editing.status]}
          </FaithText>
          {editing.deleteError ? (
            <FaithText variant="caption" color="danger">
              {editing.deleteError}
            </FaithText>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Edit or delete a verse note; text autosaves locally while typing. */
export function VerseNoteScreen({ noteId }: { noteId: string }) {
  const { note, isLoading, error } = useVerseNote(noteId);
  if (isLoading) return <LoadingState label="Loading note" />;
  if (error || !note) {
    return (
      <>
        <Stack.Screen options={{ title: 'Note' }} />
        <EmptyState
          icon="note"
          title={error ? 'This note didn’t open' : 'This note was deleted'}
          message={error ? 'Please go back and try again.' : 'It may have been removed on this or another device.'}
          actionLabel="Go back"
          onAction={goBack}
        />
      </>
    );
  }
  return <NoteEditorBody key={note.id} note={note} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 48, gap: 16 },
});
