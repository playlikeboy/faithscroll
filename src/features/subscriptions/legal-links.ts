import * as WebBrowser from 'expo-web-browser';

import { logger } from '@/lib/logger';

export type LegalDocument = 'privacy' | 'terms';

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^https:\/\//.test(trimmed) ? trimmed : null;
}

/** Hosted policy URLs (public values). Null when not configured. */
export function getLegalUrl(document: LegalDocument): string | null {
  return document === 'privacy' ? clean(process.env.EXPO_PUBLIC_PRIVACY_URL) : clean(process.env.EXPO_PUBLIC_TERMS_URL);
}

/**
 * Open a legal document in an in-app browser. Returns false when no hosted URL is configured
 * (callers then show the in-app summary on the About screen) or the browser failed to open.
 */
export async function openLegalDocument(document: LegalDocument): Promise<boolean> {
  const url = getLegalUrl(document);
  if (!url) return false;
  try {
    await WebBrowser.openBrowserAsync(url);
    return true;
  } catch (error) {
    logger.error('Could not open legal document', error, { document });
    return false;
  }
}
