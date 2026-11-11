import { Share } from 'react-native';

import { logger } from '@/lib/logger';

export interface SharedVerse {
  text: string | null;
  reference: string;
  translation: string;
}

export function verseShareMessage({ text, reference, translation }: SharedVerse): string {
  const citation = `${reference} (${translation})`;
  return text ? `“${text}”\n— ${citation}` : citation;
}

/** Opens the system share sheet. Only Scripture text is shared — never personal notes. */
export async function shareVerse(verse: SharedVerse): Promise<void> {
  try {
    await Share.share({ message: verseShareMessage(verse) });
  } catch (error) {
    logger.warn('Share sheet failed', { reason: error instanceof Error ? error.name : 'unknown' });
  }
}
