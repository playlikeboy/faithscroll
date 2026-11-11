import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, FaithButton, FaithText, Icon } from '@/components/ui';
import { MAX_REFLECTION_LENGTH } from '@/features/today/repository';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface DailyReflectionCardProps {
  prompt: string;
  text: string;
  onChangeText: (text: string) => void;
  passageLabel: string | null;
  onAttachPassage: () => void;
  onRemovePassage: () => void;
  canSave: boolean;
  onSave: () => void;
  isSaved: boolean;
  onOpenEntry: () => void;
  error: string | null;
}

/** A short reflection on today's prompt, saved to the journal — always optional, never nagging. */
export function DailyReflectionCard({
  prompt,
  text,
  onChangeText,
  passageLabel,
  onAttachPassage,
  onRemovePassage,
  canSave,
  onSave,
  isSaved,
  onOpenEntry,
  error,
}: DailyReflectionCardProps) {
  const { colors, fonts, fontSizes, radii } = useTheme();

  return (
    <Card style={styles.card}>
      <FaithText variant="label">Daily reflection</FaithText>
      <FaithText variant="title" accessibilityRole="header">
        {prompt}
      </FaithText>

      <TextInput
        value={text}
        onChangeText={onChangeText}
        multiline
        maxLength={MAX_REFLECTION_LENGTH}
        placeholder="Write a few words…"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={`Reflection. ${prompt}`}
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            borderRadius: radii.md,
            fontFamily: fonts.serif,
            fontSize: fontSizes.body,
            backgroundColor: colors.background,
          },
        ]}
      />

      <View style={styles.passageRow}>
        {passageLabel ? (
          <>
            <Chip label={passageLabel} icon="bible" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${passageLabel}`}
              onPress={onRemovePassage}
              hitSlop={8}
              style={styles.remove}>
              <Icon name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          </>
        ) : (
          <Chip label="Attach a passage" icon="add" onPress={onAttachPassage} accessibilityHint="Optional" />
        )}
      </View>

      {error ? (
        <FaithText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </FaithText>
      ) : null}

      {isSaved ? (
        <View style={styles.saved} accessibilityLiveRegion="polite">
          <Icon name="check" size={16} color={colors.primaryText} />
          <FaithText variant="secondary" style={styles.savedText}>
            Saved to your journal.
          </FaithText>
          <Pressable accessibilityRole="button" accessibilityLabel="Open entry" onPress={onOpenEntry} hitSlop={8}>
            <FaithText variant="secondary" weight="600" color="primaryText">
              Open entry
            </FaithText>
          </Pressable>
        </View>
      ) : (
        <FaithButton label="Save reflection" variant="secondary" onPress={onSave} isDisabled={!canSave} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 20 },
  input: { minHeight: 96, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, paddingVertical: 12, textAlignVertical: 'top' },
  passageRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  remove: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: MIN_TOUCH_TARGET },
  savedText: { flex: 1 },
});
