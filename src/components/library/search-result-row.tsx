import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon, type IconName } from '@/components/ui';
import type { SearchResult, SearchResultType } from '@/features/search/types';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

const TYPE_ICONS: Record<SearchResultType, IconName> = {
  journal_entry: 'journal',
  prayer_entry: 'prayer',
  sermon: 'sermons',
  verse_note: 'note',
  action_item: 'action',
  collection: 'collection',
  saved_verse: 'bookmark',
  highlight: 'highlight',
};

export interface SearchResultRowProps {
  result: SearchResult;
  onPress: () => void;
}

export function SearchResultRow({ result, onPress }: SearchResultRowProps) {
  const { colors } = useTheme();
  const label = [result.title, result.subtitle, result.snippet].filter(Boolean).join(', ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <Icon name={TYPE_ICONS[result.type]} size={18} color={colors.primaryText} />
      </View>
      <View style={styles.body}>
        <FaithText variant="heading" numberOfLines={2}>
          {result.title}
        </FaithText>
        {result.subtitle ? (
          <FaithText variant="caption" numberOfLines={1}>
            {result.subtitle}
          </FaithText>
        ) : null}
        {result.snippet ? (
          <FaithText variant="secondary" numberOfLines={3}>
            {result.snippet}
          </FaithText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 10, minHeight: MIN_TOUCH_TARGET + 8 },
  pressed: { opacity: 0.6 },
  icon: { paddingTop: 2 },
  body: { flex: 1, gap: 2 },
});
