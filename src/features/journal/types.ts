import { JOURNAL_ENTRY_TYPES, type journalEntries } from '@/db/schema';
import type { IconName } from '@/components/ui';

export type JournalEntryType = (typeof JOURNAL_ENTRY_TYPES)[number];
export type JournalEntry = typeof journalEntries.$inferSelect;

export const JOURNAL_TYPE_LABELS: Readonly<Record<JournalEntryType, string>> = {
  reflection: 'Daily reflection',
  bible_study: 'Bible study',
  sermon_reflection: 'Sermon reflection',
  prayer: 'Prayer',
  gratitude: 'Gratitude',
  personal: 'Personal thoughts',
};

export const JOURNAL_TYPE_ICONS: Readonly<Record<JournalEntryType, IconName>> = {
  reflection: 'reflect',
  bible_study: 'study',
  sermon_reflection: 'sermons',
  prayer: 'prayer',
  gratitude: 'heart',
  personal: 'journal',
};

/** The six reflection prompts from PRD §6.4. */
export const JOURNAL_PROMPTS: readonly string[] = [
  'What stood out to me today?',
  'What am I learning?',
  'What am I struggling with?',
  'What am I grateful for?',
  'What do I want to remember?',
  'What action can I take?',
];

export const DEFAULT_JOURNAL_TYPE: JournalEntryType = 'personal';

export function isJournalEntryType(value: unknown): value is JournalEntryType {
  return typeof value === 'string' && (JOURNAL_ENTRY_TYPES as readonly string[]).includes(value);
}
