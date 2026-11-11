import { Platform } from 'react-native';

/** Font family names registered by `useFaithFonts`. */
export const fontFamilies = {
  serif: 'Literata_400Regular',
  serifItalic: 'Literata_400Regular_Italic',
  serifMedium: 'Literata_500Medium',
  serifSemiBold: 'Literata_600SemiBold',
  /** iOS system font (SF Pro). */
  sans: Platform.select({ ios: 'System', default: undefined }),
} as const;

/** Sizes from PRD §10.2. */
export const fontSizes = {
  screenTitle: 32,
  sectionHeading: 22,
  scripture: 21,
  body: 17,
  secondary: 14,
  caption: 12,
} as const;

/** Reader text-size steps the user can choose between. */
export const SCRIPTURE_SIZES = [17, 19, 21, 23, 26, 29] as const;
export const DEFAULT_SCRIPTURE_SIZE_INDEX = 2;

/** Scripture line height ≈1.55× font size (PRD asks for 1.5–1.65). */
export const SCRIPTURE_LINE_HEIGHT_RATIO = 1.55;

export function scriptureLineHeight(fontSize: number): number {
  return Math.round(fontSize * SCRIPTURE_LINE_HEIGHT_RATIO);
}

/** Tabular numerals for timers and timestamps. */
export const tabularNums = { fontVariant: ['tabular-nums'] as ('tabular-nums')[] };
