import type { HighlightColorValue } from '@/features/bible/annotations/highlights';

export const HIGHLIGHT_NAMES: Record<HighlightColorValue, string> = {
  gold: 'Gold',
  sage: 'Sage',
  sky: 'Sky',
  rose: 'Rose',
};

export interface VerseState {
  highlight?: HighlightColorValue | null;
  hasNote?: boolean;
  isBookmarked?: boolean;
  isSelected?: boolean;
}

/** VoiceOver label for one verse: number, text, then its annotations (never colour alone). */
export function verseAccessibilityLabel(verseNumber: number, text: string, state: VerseState = {}): string {
  const base = `Verse ${verseNumber}. ${text.trim()}`;
  const extras = [
    state.highlight ? `Highlighted ${HIGHLIGHT_NAMES[state.highlight].toLowerCase()}` : null,
    state.hasNote ? 'Has a note' : null,
    state.isBookmarked ? 'Bookmarked' : null,
    state.isSelected ? 'Selected as range start' : null,
  ].filter((part): part is string => part !== null);
  if (extras.length === 0) return base;
  const joiner = /[.!?…"'”’]$/.test(base) ? ' ' : '. ';
  return `${base}${joiner}${extras.join('. ')}`;
}
