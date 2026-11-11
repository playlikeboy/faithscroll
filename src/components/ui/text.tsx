import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorTokens, type Theme } from '@/theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodySerif'
  | 'secondary'
  | 'caption'
  | 'label'
  | 'scripture';

type TextColor = Exclude<keyof ColorTokens, 'highlight'>;

export interface FaithTextProps extends TextProps {
  variant?: TextVariant;
  color?: TextColor;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
}

function variantStyle(variant: TextVariant, theme: Theme): TextStyle {
  const { fonts, fontSizes } = theme;
  switch (variant) {
    case 'display':
      return { fontFamily: fonts.serifSemiBold, fontSize: fontSizes.screenTitle, lineHeight: 40, letterSpacing: -0.3 };
    case 'title':
      return { fontFamily: fonts.serifMedium, fontSize: fontSizes.sectionHeading, lineHeight: 29 };
    case 'heading':
      return { fontFamily: fonts.sans, fontSize: fontSizes.body, lineHeight: 22, fontWeight: '600' };
    case 'body':
      return { fontFamily: fonts.sans, fontSize: fontSizes.body, lineHeight: 24 };
    case 'bodySerif':
      return { fontFamily: fonts.serif, fontSize: fontSizes.body, lineHeight: 27 };
    case 'secondary':
      return { fontFamily: fonts.sans, fontSize: fontSizes.secondary, lineHeight: 20 };
    case 'caption':
      return { fontFamily: fonts.sans, fontSize: fontSizes.caption, lineHeight: 16 };
    case 'label':
      return {
        fontFamily: fonts.sans,
        fontSize: fontSizes.caption,
        lineHeight: 16,
        fontWeight: '600',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
      };
    case 'scripture':
      return { fontFamily: fonts.serif, fontSize: fontSizes.scripture, lineHeight: 33 };
  }
}

const DEFAULT_COLOR: Partial<Record<TextVariant, TextColor>> = {
  secondary: 'textSecondary',
  caption: 'textSecondary',
  label: 'textSecondary',
  scripture: 'scripture',
};

/** Themed text. Supports Dynamic Type by default (allowFontScaling). */
export function FaithText({ variant = 'body', color, align, weight, style, ...rest }: FaithTextProps) {
  const theme = useTheme();
  const tone = color ?? DEFAULT_COLOR[variant] ?? 'text';
  return (
    <Text
      maxFontSizeMultiplier={variant === 'display' ? 1.6 : 2.2}
      style={[variantStyle(variant, theme), { color: theme.colors[tone] }, align && { textAlign: align }, weight && { fontWeight: weight }, style]}
      {...rest}
    />
  );
}
