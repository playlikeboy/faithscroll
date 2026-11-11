import { Stack, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NoteEditor } from '@/components/editor/note-editor';
import { LinkedItemsList } from '@/components/links/linked-items-list';
import { LinkedPassages } from '@/components/links/linked-passages';
import { TagEditor } from '@/components/links/tag-editor';
import { Card, Divider, ErrorState, FaithButton, FaithText, IconButton } from '@/components/ui';
import { usePassagePicker } from '@/features/bible/use-passage-picker';
import { rangeToIds } from '@/features/bible/verse-id';
import { formatCalendarDate, parseLocalDate } from '@/features/journal/dates';
import type { JournalPrefill } from '@/features/journal/prefill';
import { useJournalEditor } from '@/features/journal/use-journal-editor';
import { describeVerseRange } from '@/features/links/reference-text';
import { linkedItemHref, passageHref } from '@/features/links/routes';
import { useLinkPicker } from '@/features/links/use-link-picker';
import { GUTTER, useTheme, useThemedStyles, type Theme } from '@/theme';

import { DateTimeField } from './date-time-field';
import { EditorHeaderActions } from './editor-header-actions';
import { EntryTypeFilter } from './entry-type-filter';
import { PromptChips } from './prompt-chips';

export interface JournalEditorScreenProps {
  /** Existing entry id, or undefined for a new entry. */
  entryId?: string;
  prefill: JournalPrefill;
}

export function JournalEditorScreen({ entryId: entryIdParam, prefill }: JournalEditorScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const editor = useJournalEditor(entryIdParam, prefill);
  const pickPassage = usePassagePicker();
  const pickLink = useLinkPicker();
  const { draft, connections, autosave, entryId } = editor;

  if (editor.status !== 'ready') {
    return (
      <SafeAreaView edges={[]} style={styles.root}>
        <Stack.Screen options={{ title: 'Journal' }} />
        <ErrorState
          title={editor.status === 'not_found' ? 'Entry not found' : "We couldn't open this entry"}
          message={editor.status === 'not_found' ? 'It may have been deleted.' : 'Your journal is safe on this device. Please try again.'}
        />
      </SafeAreaView>
    );
  }

  const done = async () => {
    if (await autosave.flush()) router.back();
  };

  const addPassage = async () => {
    const range = await pickPassage({ title: 'Link a passage' });
    if (range) editor.attachPassage(rangeToIds(range));
  };

  const insertScripture = async (): Promise<string | null> => {
    const range = await pickPassage({ title: 'Insert a passage' });
    if (!range) return null;
    const ids = rangeToIds(range);
    editor.attachPassage(ids);
    return describeVerseRange(ids.startVerseId, ids.endVerseId);
  };

  const addLink = async () => {
    const target = await pickLink({ exclude: entryId ? { type: 'journal_entry', id: entryId } : undefined, title: 'Link to…' });
    if (target) editor.attachLink(target);
  };

  const confirmDelete = () => {
    const unsaved = entryId === null;
    Alert.alert(
      unsaved ? 'Discard this draft?' : 'Delete this entry?',
      unsaved ? 'Nothing has been saved yet.' : 'The entry and its links will be removed from your journal.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: unsaved ? 'Discard' : 'Delete',
          style: 'destructive',
          onPress: () => {
            if (editor.deleteEntry()) router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <Stack.Screen
        options={{
          title: entryIdParam ? 'Journal entry' : 'New entry',
          headerRight: () => <EditorHeaderActions status={autosave.status} hasSaved={entryId !== null} onDone={done} />,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic">
        <EntryTypeFilter value={draft.entryType} onChange={(type) => type && editor.setEntryType(type)} />
        <DateTimeField
          label="Date"
          value={parseLocalDate(draft.entryDate) ?? new Date()}
          displayValue={formatCalendarDate(draft.entryDate)}
          maximumDate={new Date()}
          onChange={editor.setEntryDate}
        />
        <TextInput
          value={draft.title}
          onChangeText={editor.setTitle}
          placeholder="Title"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Entry title"
          style={styles.title}
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="next"
          maxLength={200}
        />
        {draft.prompt ? (
          <Card tone="muted" style={styles.promptCard}>
            <FaithText variant="bodySerif" style={styles.promptText}>
              {draft.prompt}
            </FaithText>
            <IconButton icon="close" size={14} accessibilityLabel="Remove prompt" onPress={editor.clearPrompt} />
          </Card>
        ) : null}
        <NoteEditor
          value={draft.content}
          onChangeText={editor.setContent}
          placeholder={draft.prompt ? 'Write your reflection…' : 'Write freely. Only you can see this.'}
          accessibilityLabel="Journal entry text"
          autoFocus={!entryIdParam && !draft.prompt}
          minHeight={220}
          onRequestScripture={insertScripture}
        />
        {autosave.status === 'error' ? (
          <View style={styles.inlineError} accessibilityLiveRegion="polite">
            <FaithText variant="secondary" color="danger" style={styles.flex}>
              We couldn&apos;t save just now. Your words are still here.
            </FaithText>
            <FaithButton label="Try again" variant="secondary" onPress={() => void autosave.flush()} />
          </View>
        ) : null}
        <PromptChips onInsert={editor.insertPrompt} />
        {editor.actionError ? (
          <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
            {editor.actionError}
          </FaithText>
        ) : null}
        <Divider />
        <LinkedPassages
          passages={connections?.passages ?? []}
          onAdd={addPassage}
          onOpen={(item) => router.push(passageHref(item.startVerseId))}
          onRemove={editor.removePassage}
        />
        <LinkedItemsList
          items={connections?.links ?? []}
          onAdd={addLink}
          onOpen={(item) => router.push(linkedItemHref(item.type, item.id))}
          onRemove={editor.removeConnection}
        />
        <TagEditor tags={connections?.tags ?? []} suggestions={connections?.allTags} onAdd={editor.addTag} onRemove={editor.removeTag} />
        <Divider />
        <FaithButton label={entryId ? 'Delete entry' : 'Discard draft'} icon="trash" variant="destructive" onPress={confirmDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = ({ colors, fonts, fontSizes }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 48, gap: 18 },
    title: {
      fontFamily: fonts.serifMedium,
      fontSize: fontSizes.sectionHeading,
      color: colors.text,
      paddingVertical: 4,
    },
    promptCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
    promptText: { flex: 1, fontStyle: 'italic' },
    inlineError: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    flex: { flex: 1 },
  });
