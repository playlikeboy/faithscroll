import { StyleSheet, TextInput, View } from 'react-native';

import { Icon, IconButton } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

/** Search input with a clear button. */
export function SearchField({ value, onChangeText, placeholder = 'Search your library' }: SearchFieldProps) {
  const { colors, fonts, fontSizes, radii } = useTheme();
  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md }]}>
      <Icon name="search" size={18} color={colors.textSecondary} />
      <TextInput
        accessibilityRole="search"
        accessibilityLabel="Search your library"
        accessibilityHint="Searches journal, prayers, sermons, notes, actions and collections, or type a Bible reference"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        maxLength={200}
        style={[styles.input, { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.body }]}
      />
      {value ? <IconButton icon="close" size={16} accessibilityLabel="Clear search" onPress={() => onChangeText('')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: MIN_TOUCH_TARGET + 4,
    paddingLeft: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  input: { flex: 1, paddingVertical: 10 },
});
