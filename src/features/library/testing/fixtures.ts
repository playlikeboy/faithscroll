/**
 * Test-only seed helpers for library/search/plans tests (real SQLite via `createTestDb`).
 * Never import from app code.
 */
import {
  actionItems,
  collectionItems,
  collections,
  entityTags,
  highlights,
  journalEntries,
  planProgress,
  prayerEntries,
  savedVerses,
  scriptureReferences,
  sermonNotes,
  sermonSeries,
  sermons,
  tags,
  transcripts,
  verseNotes,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

type Insert<T extends { $inferInsert: unknown }> = Partial<T['$inferInsert']>;

export function seedJournalEntry(db: AppDatabase, values: Insert<typeof journalEntries> = {}): string {
  const id = values.id ?? nextId('journal');
  db.insert(journalEntries).values({ entryDate: '2026-11-10', ...values, id }).run();
  return id;
}

export function seedPrayer(db: AppDatabase, values: Insert<typeof prayerEntries> = {}): string {
  const id = values.id ?? nextId('prayer');
  db.insert(prayerEntries).values({ title: 'A prayer', ...values, id }).run();
  return id;
}

export function seedActionItem(db: AppDatabase, values: Insert<typeof actionItems> = {}): string {
  const id = values.id ?? nextId('action');
  db.insert(actionItems).values({ title: 'An action', ...values, id }).run();
  return id;
}

export function seedSeries(db: AppDatabase, values: Insert<typeof sermonSeries> = {}): string {
  const id = values.id ?? nextId('series');
  db.insert(sermonSeries).values({ title: 'A series', ...values, id }).run();
  return id;
}

export function seedSermon(db: AppDatabase, values: Insert<typeof sermons> = {}): string {
  const id = values.id ?? nextId('sermon');
  db.insert(sermons).values({ title: 'A sermon', ...values, id }).run();
  return id;
}

export function seedSermonNote(db: AppDatabase, sermonId: string, content: string): string {
  const id = nextId('sermon-note');
  db.insert(sermonNotes).values({ id, sermonId, content }).run();
  return id;
}

export function seedTranscript(db: AppDatabase, sermonId: string, text: string): string {
  const id = nextId('transcript');
  db.insert(transcripts).values({ id, sermonId, text, status: 'completed' }).run();
  return id;
}

export function seedVerseNote(db: AppDatabase, values: Insert<typeof verseNotes> = {}): string {
  const id = values.id ?? nextId('verse-note');
  db.insert(verseNotes).values({ startVerseId: 43003016, endVerseId: 43003016, ...values, id }).run();
  return id;
}

export function seedSavedVerse(db: AppDatabase, values: Insert<typeof savedVerses> = {}): string {
  const id = values.id ?? nextId('saved');
  db.insert(savedVerses).values({ startVerseId: 43003016, endVerseId: 43003016, ...values, id }).run();
  return id;
}

export function seedHighlight(db: AppDatabase, values: Insert<typeof highlights> = {}): string {
  const id = values.id ?? nextId('highlight');
  db.insert(highlights).values({ verseId: 43003016, color: 'gold', ...values, id }).run();
  return id;
}

export function seedCollection(db: AppDatabase, values: Insert<typeof collections> = {}): string {
  const id = values.id ?? nextId('collection');
  db.insert(collections).values({ title: 'A collection', ...values, id }).run();
  return id;
}

export function seedCollectionItem(db: AppDatabase, values: Insert<typeof collectionItems> & Pick<typeof collectionItems.$inferInsert, 'collectionId' | 'entityType' | 'entityId'>): string {
  const id = values.id ?? nextId('collection-item');
  db.insert(collectionItems).values({ ...values, id }).run();
  return id;
}

export function seedTag(db: AppDatabase, name: string, tagged: { entityType: typeof entityTags.$inferInsert.entityType; entityId: string }[] = []): string {
  const id = nextId('tag');
  db.insert(tags).values({ id, name }).run();
  for (const item of tagged) db.insert(entityTags).values({ ...item, tagId: id }).run();
  return id;
}

export function seedReference(db: AppDatabase, values: Insert<typeof scriptureReferences> & Pick<typeof scriptureReferences.$inferInsert, 'sourceType' | 'sourceId' | 'startVerseId' | 'endVerseId'>): string {
  const id = values.id ?? nextId('reference');
  db.insert(scriptureReferences).values({ referenceText: 'Reference', ...values, id }).run();
  return id;
}

export function seedPlanProgress(db: AppDatabase, values: Insert<typeof planProgress> & { planId: string }): string {
  const id = values.id ?? nextId('plan');
  db.insert(planProgress).values({ ...values, id }).run();
  return id;
}
