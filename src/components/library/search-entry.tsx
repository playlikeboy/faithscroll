import { Pressable, StyleSheet } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface SearchEntryProps {
  onPress: () => void;
}

/** Looks like a search field; opens universal search. */
export function SearchEntry({ onPress }: SearchEntryProps) {
  const { colors, radii } = useTheme();
  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel="Search your library"
      accessibilityHint="Searches the Bible, topics, your journal, prayers, sermons and notes"
      onPress={onPress}
      style={({ pressed }) => [
        styles.field,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Icon name="search" size={18} color={colors.textSecondary} />
      <FaithText variant="body" color="textSecondary">
        Search the Bible, notes, prayers…
      </FaithText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: MIN_TOUCH_TARGET + 4,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
