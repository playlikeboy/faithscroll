import { useMemo } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { palettes, type ColorSchemeName, type ColorTokens } from './colors';
import { radii, spacing } from './spacing';
import { fontFamilies, fontSizes } from './typography';

export * from './colors';
export * from './spacing';
export * from './typography';

export interface Theme {
  scheme: ColorSchemeName;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  fonts: typeof fontFamilies;
  fontSizes: typeof fontSizes;
}

const themes: Record<ColorSchemeName, Theme> = {
  light: { scheme: 'light', colors: palettes.light, spacing, radii, fonts: fontFamilies, fontSizes },
  dark: { scheme: 'dark', colors: palettes.dark, spacing, radii, fonts: fontFamilies, fontSizes },
};

/**
 * Current theme. The user's Light/Dark/System preference is applied globally via
 * `Appearance.setColorScheme` in the root layout, so `useColorScheme` already reflects it.
 */
export function useTheme(): Theme {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Build a StyleSheet from the theme once per colour scheme.
 * Define `factory` at module scope so its identity is stable.
 */
export function useThemedStyles<T extends NamedStyles>(factory: (theme: Theme) => T): Readonly<T> {
  const theme = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}
