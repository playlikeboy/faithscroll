import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { FaithText } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  helper?: string;
}

export function TextField({ label, error, helper, multiline, ...rest }: TextFieldProps) {
  const { colors, fonts, fontSizes, radii } = useTheme();
  return (
    <View style={styles.field}>
      <FaithText variant="label">{label}</FaithText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radii.md,
            fontFamily: fonts.sans,
            fontSize: fontSizes.body,
          },
          multiline && styles.multiline,
        ]}
        {...rest}
      />
      {error ? (
        <FaithText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </FaithText>
      ) : helper ? (
        <FaithText variant="caption">{helper}</FaithText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: { minHeight: MIN_TOUCH_TARGET + 4, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth * 2 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
});
