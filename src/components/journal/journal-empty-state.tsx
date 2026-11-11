import { StyleSheet, View } from 'react-native';

import { Chip, EmptyState, FaithButton, FaithText, Icon } from '@/components/ui';
import { JOURNAL_PROMPTS } from '@/features/journal/types';
import { useTheme } from '@/theme';

export interface JournalEmptyStateProps {
  /** True when a filter or search is hiding entries (as opposed to an empty journal). */
  isFiltered: boolean;
  onNewEntry: () => void;
  onPrompt: (prompt: string) => void;
  onClearFilters: () => void;
}

export function JournalEmptyState({ isFiltered, onNewEntry, onPrompt, onClearFilters }: JournalEmptyStateProps) {
  const { colors } = useTheme();

  if (isFiltered) {
    return (
      <EmptyState
        icon="search"
        title="Nothing here yet"
        message="No entries match this filter. Try another word or type."
        actionLabel="Show all entries"
        onAction={onClearFilters}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Icon name="journal" size={32} color={colors.textTertiary} />
      <FaithText variant="title" align="center" accessibilityRole="header">
        A quiet place to reflect
      </FaithText>
      <FaithText variant="secondary" align="center" style={styles.message}>
        Your journal is private to you. Begin with a blank page, or let one of these questions start you off.
      </FaithText>
      <View style={styles.prompts}>
        {JOURNAL_PROMPTS.map((prompt) => (
          <Chip key={prompt} label={prompt} onPress={() => onPrompt(prompt)} accessibilityHint="Starts a new entry with this prompt" />
        ))}
      </View>
      <FaithButton label="New entry" icon="add" onPress={onNewEntry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 8, gap: 14 },
  message: { maxWidth: 320 },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginVertical: 4 },
});
