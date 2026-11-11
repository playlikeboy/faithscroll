import { eq } from 'drizzle-orm';

import { outbox, sermonRecaps } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';

import {
  createActionItem,
  deleteActionItem,
  getActionItem,
  listActionItems,
  setActionItemCompleted,
  setActionItemReminder,
  updateActionItem,
} from '../action-items';
import { parseVerseSource, resolveActionSources } from '../action-sources';
import { listHighlightGroups, listSavedVerses, listVerseNotes } from '../annotation-lists';
import { getCollectionDetail, listCollectionSummaries } from '../collection-views';
import { getLibraryCounts } from '../counts';
import {
  seedActionItem,
  seedCollection,
  seedCollectionItem,
  seedHighlight,
  seedJournalEntry,
  seedPlanProgress,
  seedPrayer,
  seedSavedVerse,
  seedSeries,
  seedSermon,
  seedVerseNote,
} from '../testing/fixtures';

const DELETED = '2026-11-01T00:00:00.000Z';

let db: AppDatabase;
beforeEach(() => {
  db = createTestDb();
});

describe('getLibraryCounts', () => {
  it('counts live rows per section and ignores deleted ones', () => {
    seedSavedVerse(db);
    seedSavedVerse(db, { deletedAt: DELETED });
    seedHighlight(db, { verseId: 1001001 });
    seedHighlight(db, { verseId: 1001002 });
    seedVerseNote(db);
    seedSermon(db);
    seedSeries(db);
    seedJournalEntry(db);
    seedJournalEntry(db, { deletedAt: DELETED });
    seedPrayer(db);
    seedCollection(db);
    seedActionItem(db);
    seedActionItem(db, { completedAt: DELETED });
    seedPlanProgress(db, { planId: 'john-21' });
    seedPlanProgress(db, { planId: 'hope-7', status: 'abandoned' });

    expect(getLibraryCounts(db)).toEqual({
      savedVerses: 1,
      highlights: 2,
      notes: 1,
      sermons: 1,
      series: 1,
      journal: 1,
      prayers: 1,
      collections: 1,
      openActions: 1,
      plans: 1,
    });
  });
});

describe('annotation lists', () => {
  it('groups highlights by book in canonical order and filters by colour', () => {
    seedHighlight(db, { verseId: 45008028, color: 'gold' });
    seedHighlight(db, { verseId: 1001001, color: 'sage' });
    seedHighlight(db, { verseId: 45005001, color: 'gold' });
    seedHighlight(db, { verseId: 19023001, color: 'gold', deletedAt: DELETED });

    const groups = listHighlightGroups(db);
    expect(groups.map((group) => group.bookName)).toEqual(['Genesis', 'Romans']);
    expect(groups[1].items.map((item) => item.verseId)).toEqual([45005001, 45008028]);
    expect(listHighlightGroups(db, 'sage').map((group) => group.bookName)).toEqual(['Genesis']);
    expect(listHighlightGroups(db, 'rose')).toEqual([]);
  });

  it('lists saved verses and notes, newest first, without deleted rows', () => {
    seedSavedVerse(db, { id: 'old', createdAt: '2026-01-01T00:00:00.000Z' });
    seedSavedVerse(db, { id: 'new', createdAt: '2026-02-01T00:00:00.000Z' });
    seedSavedVerse(db, { id: 'gone', deletedAt: DELETED });
    seedVerseNote(db, { id: 'n1', updatedAt: '2026-01-01T00:00:00.000Z' });
    seedVerseNote(db, { id: 'n2', updatedAt: '2026-03-01T00:00:00.000Z' });
    expect(listSavedVerses(db).map((row) => row.id)).toEqual(['new', 'old']);
    expect(listVerseNotes(db).map((row) => row.id)).toEqual(['n2', 'n1']);
  });
});

describe('collections', () => {
  it('summarises collections alphabetically with live item counts', () => {
    const b = seedCollection(db, { title: 'beta' });
    const a = seedCollection(db, { title: 'Alpha' });
    seedCollection(db, { title: 'Removed', deletedAt: DELETED });
    seedCollectionItem(db, { collectionId: b, entityType: 'prayer_entry', entityId: seedPrayer(db) });
    seedCollectionItem(db, { collectionId: b, entityType: 'prayer_entry', entityId: 'x', deletedAt: DELETED });
    expect(listCollectionSummaries(db)).toEqual([
      { id: a, title: 'Alpha', description: null, itemCount: 0 },
      { id: b, title: 'beta', description: null, itemCount: 1 },
    ]);
  });

  it('resolves items of every linkable type with titles and links', () => {
    const collection = seedCollection(db, { title: 'Forgiveness' });
    const series = seedSeries(db, { title: 'Living With Grace' });
    const sermon = seedSermon(db, { title: 'The Power of Forgiveness', speaker: 'Pastor John', seriesId: series });
    const journal = seedJournalEntry(db, { title: 'Letting go' });
    const prayer = seedPrayer(db, { title: 'For reconciliation' });
    const action = seedActionItem(db, { title: 'Call my brother' });
    const note = seedVerseNote(db, { startVerseId: 40018021, endVerseId: 40018022, content: 'Seventy times seven' });
    const saved = seedSavedVerse(db, { startVerseId: 51003013, endVerseId: 51003013 });
    const deletedJournal = seedJournalEntry(db, { title: 'Gone', deletedAt: DELETED });
    const refs = [
      ['sermon', sermon],
      ['sermon_series', series],
      ['journal_entry', journal],
      ['prayer_entry', prayer],
      ['action_item', action],
      ['verse_note', note],
      ['saved_verse', saved],
      ['journal_entry', deletedJournal],
    ] as const;
    refs.forEach(([entityType, entityId], index) => seedCollectionItem(db, { collectionId: collection, entityType, entityId, sortOrder: index }));

    const detail = getCollectionDetail(db, collection);
    expect(detail?.title).toBe('Forgiveness');
    expect(detail?.entries.map((entry) => [entry.entityType, entry.title, entry.href])).toEqual([
      ['sermon', 'The Power of Forgiveness', `/sermons/${sermon}`],
      ['sermon_series', 'Living With Grace', `/sermons/series/${series}`],
      ['journal_entry', 'Letting go', `/journal/${journal}`],
      ['prayer_entry', 'For reconciliation', `/prayers/${prayer}`],
      ['action_item', 'Call my brother', '/library/actions'],
      ['verse_note', expect.stringContaining('Matthew 18:21'), `/bible/note/${note}`],
      ['saved_verse', expect.stringContaining('Colossians 3:13'), '/bible/read/51/3?verse=13'],
    ]);
    expect(getCollectionDetail(db, 'missing')).toBeNull();
  });
});

describe('action items', () => {
  it('creates manual actions with validation and enqueues sync', () => {
    const id = createActionItem(db, { title: '  Forgive quickly  ', notes: '', dueAt: '2026-11-20T09:00:00.000Z' });
    expect(getActionItem(db, id)).toMatchObject({ title: 'Forgive quickly', notes: null, sourceType: 'manual', dueAt: '2026-11-20T09:00:00.000Z' });
    expect(db.select().from(outbox).where(eq(outbox.entityId, id)).all()).toHaveLength(1);
    expect(() => createActionItem(db, { title: '   ' })).toThrow('Give this action a short title.');
    expect(() => createActionItem(db, { title: 'x', dueAt: 'tomorrow' })).toThrow();
  });

  it('lists open actions by due date and completed actions by completion', () => {
    const later = createActionItem(db, { title: 'Later', dueAt: '2026-12-01T09:00:00.000Z' });
    const sooner = createActionItem(db, { title: 'Sooner', dueAt: '2026-11-15T09:00:00.000Z' });
    const undated = createActionItem(db, { title: 'Whenever' });
    expect(listActionItems(db, 'open').map((row) => row.id)).toEqual([sooner, later, undated]);
    setActionItemCompleted(db, sooner, true);
    expect(listActionItems(db, 'open').map((row) => row.id)).toEqual([later, undated]);
    expect(listActionItems(db, 'completed').map((row) => row.id)).toEqual([sooner]);
    setActionItemCompleted(db, sooner, false);
    expect(getActionItem(db, sooner)?.completedAt).toBeNull();
  });

  it('updates, sets reminders and soft-deletes', () => {
    const id = createActionItem(db, { title: 'Old' });
    updateActionItem(db, id, { title: 'New', notes: 'Some notes' });
    setActionItemReminder(db, id, '2026-11-20T09:00:00.000Z', 'n1');
    expect(getActionItem(db, id)).toMatchObject({ title: 'New', notes: 'Some notes', reminderNotificationId: 'n1', version: 3 });
    deleteActionItem(db, id);
    expect(getActionItem(db, id)).toBeUndefined();
    expect(() => updateActionItem(db, id, { title: 'Again' })).toThrow('This action no longer exists.');
    expect(() => deleteActionItem(db, id)).not.toThrow();
  });

  it('resolves where an action came from', () => {
    const sermon = seedSermon(db, { title: 'The Power of Forgiveness' });
    db.insert(sermonRecaps).values({ id: 'recap-1', sermonId: sermon }).run();
    const journal = seedJournalEntry(db, { title: 'Letting go' });
    const items = [
      seedActionItem(db, { sourceType: 'sermon', sourceId: sermon }),
      seedActionItem(db, { sourceType: 'sermon_recap', sourceId: 'recap-1' }),
      seedActionItem(db, { sourceType: 'journal_entry', sourceId: journal }),
      seedActionItem(db, { sourceType: 'verse', sourceId: '45008028' }),
      seedActionItem(db, { sourceType: 'manual' }),
      seedActionItem(db, { sourceType: 'sermon', sourceId: 'deleted-sermon' }),
    ].map((id) => getActionItem(db, id)).filter((row) => row !== undefined);

    const sources = resolveActionSources(db, items);
    expect([...sources.values()].map((source) => source.href)).toEqual([
      `/sermons/${sermon}`,
      `/sermons/${sermon}/recap`,
      `/journal/${journal}`,
      '/bible/read/45/8?verse=28',
    ]);
    expect(sources.get(items[0].id)?.label).toBe('From the sermon “The Power of Forgiveness”');
    expect(sources.get(items[3].id)?.label).toMatch(/^From Romans 8:28/);
  });

  it('parses verse sources', () => {
    expect(parseVerseSource('45008028')).toEqual({ start: 45008028, end: 45008028 });
    expect(parseVerseSource('45008028-45008030')).toEqual({ start: 45008028, end: 45008030 });
    expect(parseVerseSource('45008030-45008028')).toBeNull();
    expect(parseVerseSource('Romans 8')).toBeNull();
    expect(parseVerseSource(null)).toBeNull();
  });
});
