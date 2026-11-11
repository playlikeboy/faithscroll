import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FaithButton, FaithText, ListRow, TextField } from '@/components/ui';
import type { ActionItemRow } from '@/features/library/action-items';
import type { ActionDraft } from '@/features/library/use-action-item-actions';
import { GUTTER, useTheme } from '@/theme';

import { DateTimeField } from './date-time-field';

const HOUR_MS = 60 * 60 * 1000;

export interface ActionItemEditorProps {
  /** null = create a new action. */
  item: ActionItemRow | null;
  isBusy: boolean;
  error: string | null;
  onSave: (draft: ActionDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function initialDraft(item: ActionItemRow | null): ActionDraft {
  const reminderAt = item?.reminderNotificationId && item.reminderAt ? new Date(item.reminderAt) : null;
  return {
    title: item?.title ?? '',
    notes: item?.notes ?? '',
    dueAt: item?.dueAt ? new Date(item.dueAt) : null,
    reminderAt: reminderAt && reminderAt.getTime() > Date.now() ? reminderAt : null,
  };
}

function nextHour(): Date {
  const date = new Date(Date.now() + HOUR_MS);
  date.setMinutes(0, 0, 0);
  return date;
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  const { colors } = useTheme();
  return (
    <ListRow
      title={label}
      trailing={
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityState={{ checked: value }}
          value={value}
          trackColor={{ true: colors.primary, false: colors.border }}
          onValueChange={onChange}
        />
      }
    />
  );
}

/** Page-sheet editor for an action item: title, notes, due date and an optional reminder. */
export function ActionItemEditor({ item, isBusy, error, onSave, onDelete, onClose }: ActionItemEditorProps) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<ActionDraft>(() => initialDraft(item));
  const update = (changes: Partial<ActionDraft>) => setDraft((current) => ({ ...current, ...changes }));

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FaithText variant="title" accessibilityRole="header">
            {item ? 'Edit action' : 'New action'}
          </FaithText>
          <TextField label="What will you do?" value={draft.title} onChangeText={(title) => update({ title })} maxLength={200} />
          <TextField label="Notes (optional)" value={draft.notes} onChangeText={(notes) => update({ notes })} multiline />
          <ToggleRow label="Due date" value={draft.dueAt !== null} onChange={(on) => update({ dueAt: on ? nextHour() : null })} />
          {draft.dueAt ? <DateTimeField label="Due" mode="date" value={draft.dueAt} onChange={(dueAt) => update({ dueAt })} /> : null}
          <ToggleRow label="Remind me" value={draft.reminderAt !== null} onChange={(on) => update({ reminderAt: on ? nextHour() : null })} />
          {draft.reminderAt ? (
            <DateTimeField label="Reminder" mode="datetime" value={draft.reminderAt} minimumDate={new Date()} onChange={(reminderAt) => update({ reminderAt })} />
          ) : null}
          {error ? (
            <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
              {error}
            </FaithText>
          ) : null}
          <View style={styles.buttons}>
            <FaithButton label="Save" isLoading={isBusy} isDisabled={draft.title.trim().length === 0} onPress={() => onSave(draft)} fullWidth />
            <FaithButton label="Cancel" variant="ghost" onPress={onClose} fullWidth />
            {item && onDelete ? <FaithButton label="Delete action" icon="trash" variant="destructive" onPress={onDelete} fullWidth /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: GUTTER, gap: 16, paddingBottom: 48 },
  buttons: { gap: 8, marginTop: 8 },
});
