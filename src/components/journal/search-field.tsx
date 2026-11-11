import { StyleSheet, TextInput, View } from 'react-native';

import { Icon, IconButton } from '@/components/ui';
import { MIN_TOUCH_TARGET, useTheme, useThemedStyles, type Theme } from '@/theme';

export interface SearchFieldProps {
  value: string;
  onChangeText: (next: string) => void;
  /** Visible placeholder and accessibility label. */
  placeholder: string;
  autoFocus?: boolean;
}

/** Rounded search input with a clear button. Search text never leaves the device. */
export function SearchField({ value, onChangeText, placeholder, autoFocus }: SearchFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <Icon name="search" size={16} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={placeholder}
        accessibilityRole="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        style={styles.input}
      />
      {value.length > 0 ? (
        <IconButton icon="close" size={14} accessibilityLabel="Clear search" onPress={() => onChangeText('')} />
      ) : null}
    </View>
  );
}

const createStyles = ({ colors, radii, fonts, fontSizes }: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 12,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      minHeight: MIN_TOUCH_TARGET,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      color: colors.text,
      fontFamily: fonts.sans,
      fontSize: fontSizes.body,
    },
  });
