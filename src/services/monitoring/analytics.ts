/**
 * CONTRACT STUB — owned by the monetization agent (implements transport + consent).
 * Privacy-safe product analytics (PRD §15). Events carry NO user content:
 * no prayer/journal/note text, no transcripts, no search queries, no Bible notes.
 */
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

export function track(_event: AnalyticsEvent): void {
  // no-op until implemented
}
