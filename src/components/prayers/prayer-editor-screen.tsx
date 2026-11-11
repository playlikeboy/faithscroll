import { Stack, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditorHeaderActions } from '@/components/journal/editor-header-actions';
import { LinkedItemsList } from '@/components/links/linked-items-list';
import { LinkedPassages } from '@/components/links/linked-passages';
import { Divider, ErrorState, FaithButton, FaithText } from '@/components/ui';
import { usePassagePicker } from '@/features/bible/use-passage-picker';
import { rangeToIds } from '@/features/bible/verse-id';
import { linkedItemHref, passageHref } from '@/features/links/routes';
import { useLinkPicker } from '@/features/links/use-link-picker';
import { usePrayerEditor, type PrayerPrefill } from '@/features/prayers/use-prayer-editor';
import { GUTTER, useTheme, useThemedStyles, type Theme } from '@/theme';

import { CategoryPicker } from './category-picker';
import { PrayerStatusChanger } from './prayer-status-changer';
import { PrayerUpdatesTimeline } from './prayer-updates-timeline';
import { ReminderField } from './reminder-field';

export interface PrayerEditorScreenProps {
  /** Existing prayer id, or undefined for a new prayer. */
  prayerId?: string;
  prefill: PrayerPrefill;
}

export function PrayerEditorScreen({ prayerId: prayerIdParam, prefill }: PrayerEditorScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const editor = usePrayerEditor(prayerIdParam, prefill);
  const pickPassage = usePassagePicker();
  const pickLink = useLinkPicker();
  const { draft, prayer, prayerId, autosave } = editor;

  if (editor.status !== 'ready') {
    return (
      <SafeAreaView edges={[]} style={styles.root}>
        <Stack.Screen options={{ title: 'Prayer' }} />
        <ErrorState
          title={editor.status === 'not_found' ? 'Prayer not found' : "We couldn't open this prayer"}
          message={editor.status === 'not_found' ? 'It may have been deleted.' : 'Your prayers are safe on this device. Please try again.'}
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

  const addLink = async () => {
    const target = await pickLink({ exclude: prayerId ? { type: 'prayer_entry', id: prayerId } : undefined, title: 'Link to…' });
    if (target) editor.attachLink(target);
  };

  const confirmDelete = () => {
    const unsaved = prayerId === null;
    Alert.alert(unsaved ? 'Discard this prayer?' : 'Delete this prayer?', unsaved ? 'Nothing has been saved yet.' : 'Its updates and reminder will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: unsaved ? 'Discard' : 'Delete',
        style: 'destructive',
        onPress: () => {
          void editor.deletePrayer().then((deleted) => deleted && router.back());
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.root}>
      <Stack.Screen
        options={{
          title: prayerIdParam ? 'Prayer' : 'New prayer',
          headerRight: () => <EditorHeaderActions status={autosave.status} hasSaved={prayerId !== null} onDone={done} />,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic">
        <TextInput
          value={draft.title}
          onChangeText={editor.setTitle}
          placeholder="What would you like to pray about?"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Prayer title"
          style={styles.title}
          multiline
          submitBehavior="blurAndSubmit"
          maxLength={200}
          autoFocus={!prayerIdParam}
        />
        <TextInput
          value={draft.content}
          onChangeText={editor.setContent}
          placeholder="Write your prayer, in your own words…"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Prayer description"
          style={styles.body}
          multiline
          textAlignVertical="top"
        />
        {autosave.status === 'error' ? (
          <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
            We couldn&apos;t save just now. Your words are still here — we&apos;ll keep trying.
          </FaithText>
        ) : null}
        {editor.actionError ? (
          <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
            {editor.actionError}
          </FaithText>
        ) : null}
        <CategoryPicker value={draft.category} onChange={editor.setCategory} />
        <LinkedPassages
          passages={editor.connections?.passages ?? []}
          onAdd={addPassage}
          onOpen={(item) => router.push(passageHref(item.startVerseId))}
          onRemove={editor.removePassage}
        />
        {prayer ? (
          <>
            <Divider />
            <PrayerStatusChanger status={prayer.status} onChangeStatus={editor.changeStatus} onAddNote={editor.addNote} />
            {prayer.status === 'answered' && prayer.answeredAt ? (
              <FaithText variant="secondary">Answered on {new Date(prayer.answeredAt).toLocaleDateString()}</FaithText>
            ) : null}
            <ReminderField reminderAt={prayer.reminderAt} onSet={editor.setReminder} />
            <PrayerUpdatesTimeline updates={editor.updates} />
            <LinkedItemsList
              items={editor.connections?.links ?? []}
              onAdd={addLink}
              onOpen={(item) => router.push(linkedItemHref(item.type, item.id))}
              onRemove={editor.removeConnection}
              addLabel="Link a journal entry or sermon"
            />
          </>
        ) : (
          <FaithText variant="caption">Your prayer saves as you write. Status, notes and reminders appear once it&apos;s saved.</FaithText>
        )}
        <Divider />
        <FaithButton label={prayerId ? 'Delete prayer' : 'Discard'} icon="trash" variant="destructive" onPress={confirmDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = ({ colors, fonts, fontSizes, radii }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 48, gap: 20 },
    title: { fontFamily: fonts.serifMedium, fontSize: fontSizes.sectionHeading, color: colors.text, paddingVertical: 4 },
    body: {
      minHeight: 140,
      fontFamily: fonts.serif,
      fontSize: fontSizes.body,
      lineHeight: 27,
      color: colors.text,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 14,
    },
  });
