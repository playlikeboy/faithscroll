/**
 * Runtime validation for analytics events. Every event must match the typed union exactly
 * (no extra keys), and string properties must be short identifiers — never free text — so user
 * content cannot leak through analytics even by mistake.
 */
import { z } from 'zod';

import type { AnalyticsEvent } from './analytics';

/** Identifier-like strings only: no spaces, max 64 chars (e.g. "faith", "john-21", "plus_yearly"). */
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/);
const count = z.number().int().min(0).max(1_000_000);
const day = z.number().int().min(1).max(3_650);
const seconds = z.number().finite().min(0).max(7 * 24 * 60 * 60);
const bookId = z.number().int().min(1).max(99);
const chapter = z.number().int().min(1).max(200);

function event<N extends string, S extends z.ZodRawShape>(name: N, shape: S) {
  return z.strictObject({ name: z.literal(name), ...shape });
}

export const analyticsEventSchema = z.discriminatedUnion('name', [
  event('onboarding_completed', { goal: identifier.nullable() }),
  event('chapter_opened', { bookId, chapter }),
  event('chapter_completed', { bookId, chapter }),
  event('verse_saved', {}),
  event('verse_highlighted', {}),
  event('verse_note_created', {}),
  event('study_opened', { mode: z.enum(['basic', 'deep']) }),
  event('ai_question_asked', {}),
  event('discover_session_started', { topicId: identifier }),
  event('bible_search_performed', { resultCount: count }),
  event('journal_entry_created', { entryType: identifier }),
  event('prayer_created', {}),
  event('prayer_status_changed', { status: identifier }),
  event('sermon_created', {}),
  event('recording_started', {}),
  event('recording_saved', { durationSec: seconds }),
  event('recording_interrupted', {}),
  event('bookmark_added', {}),
  event('transcription_requested', {}),
  event('transcription_completed', { durationSec: seconds }),
  event('transcription_failed', { errorCode: identifier }),
  event('recap_generated', {}),
  event('action_item_selected', {}),
  event('library_search_performed', { resultCount: count }),
  event('plan_started', { planId: identifier }),
  event('plan_day_completed', { planId: identifier, day }),
  event('paywall_viewed', { source: identifier }),
  event('purchase_completed', { productId: identifier }),
  event('purchase_restored', {}),
  event('data_exported', {}),
  event('account_deleted', {}),
]);

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Compile-time guard: the runtime schema and the exported TypeScript union must stay identical. */
const schemaMatchesContract: Equals<z.infer<typeof analyticsEventSchema>, AnalyticsEvent> = true;
void schemaMatchesContract;

/** Returns the validated event, or null when it is malformed or could carry free text. */
export function validateAnalyticsEvent(input: unknown): AnalyticsEvent | null {
  const result = analyticsEventSchema.safeParse(input);
  return result.success ? result.data : null;
}
