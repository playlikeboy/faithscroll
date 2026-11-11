/** Spoken labels for tappable note tokens (VoiceOver / TalkBack). */
import { formatReference } from '@/features/bible/reference';
import type { VerseRange } from '@/features/bible/types';
import { logger } from '@/lib/logger';

const MS_PER_SECOND = 1000;

function unit(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/** 272000 → "4 minutes 32 seconds"; 3727000 → "1 hour 2 minutes 7 seconds"; 0 → "0 seconds". */
export function spokenDuration(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / MS_PER_SECOND)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = [
    hours > 0 ? unit(hours, 'hour') : null,
    minutes > 0 ? unit(minutes, 'minute') : null,
    seconds > 0 || total === 0 ? unit(seconds, 'second') : null,
  ];
  return parts.filter((part): part is string => part !== null).join(' ');
}

export function timestampLabel(positionMs: number): string {
  return `Play from ${spokenDuration(positionMs)}`;
}

/** "Open Romans 8:28" — falls back to the text as written when formatting is unavailable. */
export function referenceLabel(range: VerseRange, writtenText: string): string {
  let formatted = '';
  try {
    formatted = formatReference(range);
  } catch (error) {
    logger.warn('Reference formatting failed', { error: error instanceof Error ? error.name : typeof error });
  }
  return `Open ${formatted.trim() || writtenText.trim()}`;
}
