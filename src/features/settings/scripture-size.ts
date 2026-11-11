import { usePreferences } from '@/stores/preferences';
import { DEFAULT_SCRIPTURE_SIZE_INDEX, SCRIPTURE_SIZES, scriptureLineHeight } from '@/theme';

export interface ScriptureTextStyle {
  fontSize: number;
  lineHeight: number;
}

export const SCRIPTURE_SIZE_LABELS = ['Smallest', 'Small', 'Default', 'Large', 'Larger', 'Largest'] as const;

export function scriptureTextStyle(sizeIndex: number): ScriptureTextStyle {
  const safeIndex = Number.isInteger(sizeIndex) && SCRIPTURE_SIZES[sizeIndex] ? sizeIndex : DEFAULT_SCRIPTURE_SIZE_INDEX;
  const fontSize = SCRIPTURE_SIZES[safeIndex];
  return { fontSize, lineHeight: scriptureLineHeight(fontSize) };
}

export function scriptureSizeLabel(sizeIndex: number): string {
  return SCRIPTURE_SIZE_LABELS[sizeIndex] ?? SCRIPTURE_SIZE_LABELS[DEFAULT_SCRIPTURE_SIZE_INDEX];
}

/** The reader's chosen Scripture size, for any surface that shows verse text. */
export function useScriptureTextStyle(): ScriptureTextStyle {
  return scriptureTextStyle(usePreferences((s) => s.scriptureSizeIndex));
}
