import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, FaithButton, FaithText, TextField } from '@/components/ui';
import { PRAYER_STATUS_DESCRIPTIONS, PRAYER_STATUS_LABELS, PRAYER_STATUS_ORDER, type PrayerStatus } from '@/features/prayers/types';

export interface PrayerStatusChangerProps {
  status: PrayerStatus;
  onChangeStatus: (status: PrayerStatus, note: string) => void;
  onAddNote: (note: string) => void;
}

type Mode = { kind: 'idle' } | { kind: 'status'; target: PrayerStatus } | { kind: 'note' };

/**
 * Status chips plus an inline composer: choosing a new status asks for an optional note
 * ("what changed?"); "Add a note" records an update without changing the status.
 */
export function PrayerStatusChanger({ status, onChangeStatus, onAddNote }: PrayerStatusChangerProps) {
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [note, setNote] = useState('');

  const reset = () => {
    setMode({ kind: 'idle' });
    setNote('');
  };

  const selectStatus = (next: PrayerStatus) => {
    if (next === status) {
      reset();
      return;
    }
    setMode({ kind: 'status', target: next });
  };

  const confirm = () => {
    if (mode.kind === 'status') onChangeStatus(mode.target, note);
    if (mode.kind === 'note' && note.trim()) onAddNote(note);
    reset();
  };

  const shown = mode.kind === 'status' ? mode.target : status;

  return (
    <View style={styles.container}>
      <FaithText variant="label" accessibilityRole="header">
        Status
      </FaithText>
      <View style={styles.chips}>
        {PRAYER_STATUS_ORDER.map((option) => (
          <Chip key={option} label={PRAYER_STATUS_LABELS[option]} isSelected={shown === option} onPress={() => selectStatus(option)} />
        ))}
      </View>
      <FaithText variant="secondary">{PRAYER_STATUS_DESCRIPTIONS[shown]}</FaithText>

      {mode.kind === 'idle' ? (
        <FaithButton label="Add a note" icon="edit" variant="ghost" onPress={() => setMode({ kind: 'note' })} style={styles.ghost} />
      ) : (
        <View style={styles.composer}>
          <TextField
            label={mode.kind === 'status' ? 'What changed? (optional)' : 'Note'}
            value={note}
            onChangeText={setNote}
            placeholder={mode.kind === 'status' ? 'A few words for later…' : 'Something to remember…'}
            multiline
            autoFocus
          />
          <View style={styles.actions}>
            <FaithButton label="Cancel" variant="secondary" onPress={reset} />
            <FaithButton
              label={mode.kind === 'status' ? `Mark as ${PRAYER_STATUS_LABELS[mode.target]}` : 'Save note'}
              onPress={confirm}
              isDisabled={mode.kind === 'note' && !note.trim()}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ghost: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  composer: { gap: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
});
