import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FaithButton, FaithText, Icon, IconButton, TextField } from '@/components/ui';
import { MAX_INTENTION_LENGTH } from '@/features/today/use-daily-intention';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface DailyIntentionProps {
  intention: string | null;
  onSave: (text: string) => void;
  onClear: () => void;
}

/** Optional one-line intention for today. Quietly resets tomorrow. */
export function DailyIntention({ intention, onSave, onClear }: DailyIntentionProps) {
  const { colors, fonts } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEditing = () => {
    setDraft(intention ?? '');
    setIsEditing(true);
  };
  const commit = () => {
    onSave(draft);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <View style={styles.editor}>
        <TextField
          label="Today's intention"
          value={draft}
          onChangeText={setDraft}
          placeholder="e.g. Be patient and kind today"
          maxLength={MAX_INTENTION_LENGTH}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={commit}
        />
        <View style={styles.editorActions}>
          <FaithButton label="Cancel" variant="ghost" onPress={() => setIsEditing(false)} />
          <FaithButton label="Save intention" variant="secondary" onPress={commit} />
        </View>
      </View>
    );
  }

  if (!intention) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Set an intention for today"
        accessibilityHint="Optional"
        onPress={startEditing}
        style={({ pressed }) => [styles.prompt, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon name="add" size={16} color={colors.primaryText} />
        <FaithText variant="secondary" weight="600" color="primaryText">
          Set an intention for today
        </FaithText>
      </Pressable>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.text} accessible accessibilityLabel={`Today's intention: ${intention}`}>
        <FaithText variant="label">Today&apos;s intention</FaithText>
        <FaithText variant="bodySerif" style={{ fontFamily: fonts.serifItalic }}>
          {intention}
        </FaithText>
      </View>
      <IconButton icon="edit" accessibilityLabel="Edit today's intention" onPress={startEditing} size={18} />
      <IconButton icon="close" accessibilityLabel="Clear today's intention" onPress={onClear} size={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH_TARGET, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { flex: 1, gap: 2 },
  editor: { gap: 8 },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
