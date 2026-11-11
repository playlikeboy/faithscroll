/**
 * CONTRACT STUB — owned by the monetization agent (implemented: transport + consent).
 * Privacy-safe product analytics (PRD §15). Events carry NO user content:
 * no prayer/journal/note text, no transcripts, no search queries, no Bible notes.
 *
 * - Every event is validated against the typed union at runtime (extra keys or free-text
 *   strings are dropped), see ./analytics-events.ts.
 * - Respects the user's opt-out (Settings → Your data).
 * - Batches to EXPO_PUBLIC_ANALYTICS_URL when set; otherwise events never leave the device
 *   (debug-logged in development).
 */
import { logger } from '@/lib/logger';

import { useAnalyticsConsent } from './analytics-consent';
import { validateAnalyticsEvent } from './analytics-events';
import { clearAnalyticsQueue, enqueueEvent } from './analytics-transport';
import { getAnalyticsUrl } from './config';

export type AnalyticsEvent =
  | { name: 'onboarding_completed'; goal: string | null }
  | { name: 'chapter_opened'; bookId: number; chapter: number }
  | { name: 'chapter_completed'; bookId: number; chapter: number }
  | { name: 'verse_saved' }
  | { name: 'verse_highlighted' }
  | { name: 'verse_note_created' }
  | { name: 'study_opened'; mode: 'basic' | 'deep' }
  | { name: 'ai_question_asked' }
  | { name: 'discover_session_started'; topicId: string }
  | { name: 'bible_search_performed'; resultCount: number }
  | { name: 'journal_entry_created'; entryType: string }
  | { name: 'prayer_created' }
  | { name: 'prayer_status_changed'; status: string }
  | { name: 'sermon_created' }
  | { name: 'recording_started' }
  | { name: 'recording_saved'; durationSec: number }
  | { name: 'recording_interrupted' }
  | { name: 'bookmark_added' }
  | { name: 'transcription_requested' }
  | { name: 'transcription_completed'; durationSec: number }
  | { name: 'transcription_failed'; errorCode: string }
  | { name: 'recap_generated' }
  | { name: 'action_item_selected' }
  | { name: 'library_search_performed'; resultCount: number }
  | { name: 'plan_started'; planId: string }
  | { name: 'plan_day_completed'; planId: string; day: number }
  | { name: 'paywall_viewed'; source: string }
  | { name: 'purchase_completed'; productId: string }
  | { name: 'purchase_restored' }
  | { name: 'data_exported' }
  | { name: 'account_deleted' };

function toProps(event: AnalyticsEvent): Record<string, string | number | boolean | null> {
  const { name: _name, ...rest } = event;
  return Object.fromEntries(
    Object.entries(rest).map(([key, value]) => [key, typeof value === 'number' ? Math.round(value) : value]),
  );
}

/** Record a product event. Never throws and never blocks the UI. */
export function track(event: AnalyticsEvent): void {
  try {
    if (!useAnalyticsConsent.getState().enabled) return;
    const valid = validateAnalyticsEvent(event);
    if (!valid) {
      // Name only: the rejected payload itself might contain the very content we refuse to send.
      logger.warn('Dropped an analytics event that failed validation', {
        name: typeof event?.name === 'string' ? event.name.slice(0, 64) : 'unknown',
      });
      return;
    }
    if (!getAnalyticsUrl()) {
      logger.debug(`analytics: ${valid.name}`);
      return;
    }
    enqueueEvent({ name: valid.name, props: toProps(valid), at: new Date().toISOString() });
  } catch (error) {
    logger.warn('Analytics tracking failed', { reason: error instanceof Error ? error.name : 'unknown' });
  }
}

/** Turn product analytics on/off. Turning off discards anything not yet sent and the install id. */
export function setAnalyticsEnabled(enabled: boolean): void {
  useAnalyticsConsent.getState().setEnabled(enabled);
  if (!enabled) clearAnalyticsQueue();
}

export function useAnalyticsEnabled(): boolean {
  return useAnalyticsConsent((state) => state.enabled);
}

/** Forget the install id (used when all local data is deleted). The opt-out choice is kept. */
export function resetAnalyticsIdentity(): void {
  clearAnalyticsQueue();
  useAnalyticsConsent.getState().resetInstallId();
}
