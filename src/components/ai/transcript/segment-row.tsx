import { memo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FaithButton, FaithText, IconButton } from '@/components/ui';
import { formatDuration } from '@/lib/time';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface SegmentRowProps {
  id: string;
  startMs: number;
  text: string;
  approximate: boolean;
  onSeek: (positionMs: number) => void;
  onSave: (id: string, text: string) => Promise<void>;
}

/** One timestamped line: tap the time (or text) to play from there, pencil to correct it inline. */
function SegmentRowComponent({ id, startMs, text, approximate, onSeek, onSave }: SegmentRowProps) {
  const { colors, fonts, fontSizes, radii } = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const time = `${approximate ? '≈' : ''}${formatDuration(startMs)}`;

  const save = async () => {
    if (draft === null || !draft.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(id, draft);
      setDraft(null);
    } catch {
      setError('This line couldn’t be saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (draft !== null) {
    return (
      <View style={styles.editing}>
        <FaithText variant="caption" style={styles.time}>
          {time}
        </FaithText>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          autoFocus
          accessibilityLabel={`Edit transcript line at ${formatDuration(startMs)}`}
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.md, fontFamily: fonts.sans, fontSize: fontSizes.body },
          ]}
        />
        {error ? (
          <FaithText variant="caption" color="danger" accessibilityLiveRegion="polite">
            {error}
          </FaithText>
        ) : null}
        <View style={styles.editActions}>
          <FaithButton label="Cancel" variant="ghost" onPress={() => setDraft(null)} />
          <FaithButton label="Save line" onPress={() => void save()} isLoading={isSaving} isDisabled={!draft.trim()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Play from ${formatDuration(startMs)}${approximate ? ', approximate time' : ''}: ${text}`}
        onPress={() => onSeek(startMs)}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
        <FaithText variant="caption" weight="600" style={[styles.time, { color: colors.primaryText }]}>
          {time}
        </FaithText>
        <FaithText variant="body" style={styles.text}>
          {text}
        </FaithText>
      </Pressable>
      <IconButton icon="edit" size={18} accessibilityLabel={`Correct the line at ${formatDuration(startMs)}`} onPress={() => setDraft(text)} />
    </View>
  );
}

export const SegmentRow = memo(SegmentRowComponent);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingVertical: 6 },
  body: { flex: 1, flexDirection: 'row', gap: 12, minHeight: MIN_TOUCH_TARGET, paddingVertical: 6 },
  pressed: { opacity: 0.6 },
  time: { minWidth: 52, fontVariant: ['tabular-nums'], paddingTop: 3 },
  text: { flex: 1 },
  editing: { gap: 8, paddingVertical: 10 },
  input: { minHeight: 88, padding: 12, borderWidth: StyleSheet.hairlineWidth * 2, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
