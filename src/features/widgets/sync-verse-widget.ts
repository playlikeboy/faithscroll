import { Platform } from 'react-native';

import { logger } from '@/lib/logger';

import { buildVerseWidgetTimeline } from './verse-widget-timeline';

/**
 * Refresh the iOS "Verse of the Day" widget with the next two weeks of verses.
 * Safe to call on every launch: a no-op on Android/web, and failures (e.g. Expo Go, where the
 * widget extension doesn't exist) are logged, never thrown.
 */
export async function syncVerseWidget(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const entries = await buildVerseWidgetTimeline();
    // Loaded lazily so platforms and test runs without the native widget module never import it.
    const { verseOfTheDayWidget } = await import('@/widgets/verse-of-the-day');
    verseOfTheDayWidget.updateTimeline(entries);
  } catch (error) {
    logger.warn('Updating the Verse of the Day widget failed', { reason: error instanceof Error ? error.message : 'unknown' });
  }
}
