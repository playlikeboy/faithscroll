/**
 * Faithscroll palette (PRD §10.2) and semantic colour tokens.
 *
 * Brand values come straight from the PRD. Where a brand value fails WCAG AA
 * as text, a darker/lighter text variant is used instead and the brand value
 * is kept for non-text decoration only (see contrast tests).
 */
export const brand = {
  paper: '#F6F3EC',
  surface: '#FFFFFF',
  ink: '#242923',
  forest: '#203B32',
  sage: '#A4B5A2',
  sand: '#E8DFD1',
  gold: '#C4A16A',
  muted: '#77796F',
  darkBackground: '#111914',
  darkSurface: '#1C2821',
} as const;

export type HighlightColor = 'gold' | 'sage' | 'sky' | 'rose';

export const HIGHLIGHT_COLORS: readonly HighlightColor[] = ['gold', 'sage', 'sky', 'rose'];

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  /** Decorative only (icons, dividers); not AA as body text. */
  textTertiary: string;
  scripture: string;
  verseNumber: string;
  primary: string;
  onPrimary: string;
  primaryText: string;
  accent: string;
  gold: string;
  border: string;
  danger: string;
  recording: string;
  /** Tinted background used to mark AI-generated content apart from Scripture. */
  aiSurface: string;
  overlay: string;
  highlight: Record<HighlightColor, string>;
}

const light: ColorTokens = {
  background: brand.paper,
  surface: brand.surface,
  surfaceMuted: brand.sand,
  text: brand.ink,
  textSecondary: '#5E6057',
  textTertiary: brand.muted,
  scripture: brand.ink,
  verseNumber: '#8A6A35',
  primary: brand.forest,
  onPrimary: '#FFFFFF',
  primaryText: brand.forest,
  accent: brand.sage,
  gold: brand.gold,
  border: '#D6CDBC',
  danger: '#A8322A',
  recording: '#C23A2E',
  aiSurface: '#EEF1EA',
  overlay: 'rgba(17, 25, 20, 0.45)',
  highlight: {
    gold: '#F3E3C2',
    sage: '#DCE6D9',
    sky: '#D9E6EE',
    rose: '#F1DCD8',
  },
};

const dark: ColorTokens = {
  background: brand.darkBackground,
  surface: brand.darkSurface,
  surfaceMuted: '#24332A',
  text: '#ECE8DF',
  textSecondary: '#AEB2A6',
  textTertiary: '#7F857A',
  scripture: '#E9E4D8',
  verseNumber: '#C9A970',
  primary: brand.sage,
  onPrimary: brand.darkBackground,
  primaryText: '#B9C8B6',
  accent: '#7D917B',
  gold: brand.gold,
  border: '#2E3D33',
  danger: '#F08A7E',
  recording: '#FF6B5E',
  aiSurface: '#1F2C25',
  overlay: 'rgba(0, 0, 0, 0.6)',
  highlight: {
    gold: '#4A3F28',
    sage: '#2F4033',
    sky: '#283A45',
    rose: '#4A2F2C',
  },
};

export const palettes = { light, dark } as const;

export type ColorSchemeName = keyof typeof palettes;
