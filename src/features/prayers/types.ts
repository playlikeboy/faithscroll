import { PRAYER_STATUSES, type prayerEntries, type prayerUpdates } from '@/db/schema';

export type PrayerStatus = (typeof PRAYER_STATUSES)[number];
export type Prayer = typeof prayerEntries.$inferSelect;
export type PrayerUpdate = typeof prayerUpdates.$inferSelect;

export const PRAYER_STATUS_LABELS: Readonly<Record<PrayerStatus, string>> = {
  praying: 'Praying',
  ongoing: 'Ongoing',
  answered: 'Answered',
  archived: 'Archived',
};

/** Gentle one-line descriptions — never framed as success/failure. */
export const PRAYER_STATUS_DESCRIPTIONS: Readonly<Record<PrayerStatus, string>> = {
  praying: 'Holding this before God now',
  ongoing: 'A prayer you keep returning to',
  answered: 'Moments of answer and grace',
  archived: 'Set aside, still remembered',
};

export const PRAYER_STATUS_ORDER: readonly PrayerStatus[] = PRAYER_STATUSES;

export const PRAYER_CATEGORIES: readonly string[] = [
  'Family',
  'Friends',
  'Health',
  'Guidance',
  'Gratitude',
  'Church',
  'Work',
  'World',
];

export const PRAYER_REMINDER_TITLE = 'Prayer';
/** Lock-screen copy is always generic: prayer text never appears in a notification. */
export const PRAYER_REMINDER_BODY = 'A gentle reminder to pray';

export function isPrayerStatus(value: unknown): value is PrayerStatus {
  return typeof value === 'string' && (PRAYER_STATUSES as readonly string[]).includes(value);
}
