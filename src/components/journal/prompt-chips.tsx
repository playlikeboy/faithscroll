import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, FaithText } from '@/components/ui';
import { JOURNAL_PROMPTS } from '@/features/journal/types';

export interface PromptChipsProps {
  onInsert: (prompt: string) => void;
}

/** The six reflection prompts; tapping one inserts it into the entry as a heading. */
export function PromptChips({ onInsert }: PromptChipsProps) {
  return (
    <View style={styles.container}>
      <FaithText variant="label">Need a prompt?</FaithText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
        {JOURNAL_PROMPTS.map((prompt) => (
          <Chip key={prompt} label={prompt} onPress={() => onInsert(prompt)} accessibilityHint="Adds this question to your entry" />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { gap: 8, paddingVertical: 2 },
});
