import { actionItems, journalEntries, prayerEntries, sermonSeries, sermons, verseNotes } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';

import { DEFAULT_PICKER_TYPES } from '../link-picker-registry';
import { searchLinkables } from '../search';

jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));

function seed(db: AppDatabase) {
  db.insert(sermons).values({ id: 's1', title: 'The Power of Forgiveness', speaker: 'Pastor John', updatedAt: '2026-11-08T00:00:00Z' }).run();
  db.insert(sermons).values({ id: 's2', title: 'Living With Grace', speaker: 'Pastor Ann', updatedAt: '2026-11-09T00:00:00Z' }).run();
  db.insert(sermons).values({ id: 's3', title: 'Deleted forgiveness talk', deletedAt: '2026-11-09T00:00:00Z' }).run();
  db.insert(sermonSeries).values({ id: 'ser1', title: 'Forgiveness series' }).run();
  db.insert(journalEntries).values({ id: 'j1', title: 'Seventy times seven', content: 'On forgiveness', entryDate: '2026-11-09' }).run();
  db.insert(journalEntries).values({ id: 'j2', title: 'Self', content: 'Forgiveness for me', entryDate: '2026-11-10' }).run();
  db.insert(prayerEntries).values({ id: 'p1', title: 'For my brother', content: 'Help me forgive', category: 'Family' }).run();
  db.insert(actionItems).values({ id: 'a1', title: 'Call Sam', notes: 'Offer forgiveness' }).run();
  db.insert(verseNotes).values({ id: 'n1', startVerseId: 40018021, endVerseId: 40018021, content: 'forgiveness again' }).run();
}

describe('searchLinkables', () => {
  test('searches each requested type and groups results in type order', () => {
    const db = createTestDb();
    seed(db);

    const sections = searchLinkables(db, { query: 'forgiv', types: DEFAULT_PICKER_TYPES });

    expect(sections.map((s) => [s.type, s.data.map((d) => d.id).sort()])).toEqual([
      ['sermon', ['s1']],
      ['journal_entry', ['j1', 'j2']],
      ['prayer_entry', ['p1']],
      ['action_item', ['a1']],
    ]);
    expect(sections[0]?.title).toBe('Sermons');
  });

  test('excludes the source item', () => {
    const db = createTestDb();
    seed(db);

    const sections = searchLinkables(db, { query: 'forgiv', types: ['journal_entry'], exclude: { type: 'journal_entry', id: 'j2' } });

    expect(sections.flatMap((s) => s.data.map((d) => d.id))).toEqual(['j1']);
  });

  test('without a query lists recent items, newest first, limited per type', () => {
    const db = createTestDb();
    seed(db);

    const sections = searchLinkables(db, { query: '  ', types: ['sermon'], limitPerType: 1 });

    expect(sections).toEqual([expect.objectContaining({ type: 'sermon', data: [expect.objectContaining({ id: 's2' })] })]);
  });

  test('matches other fields (speaker, category, notes) and other linkable types', () => {
    const db = createTestDb();
    seed(db);

    expect(searchLinkables(db, { query: 'Pastor Ann', types: ['sermon'] })[0]?.data.map((d) => d.id)).toEqual(['s2']);
    expect(searchLinkables(db, { query: 'family', types: ['prayer_entry'] })[0]?.data.map((d) => d.id)).toEqual(['p1']);
    expect(searchLinkables(db, { query: 'forgiveness', types: ['sermon_series', 'verse_note'] }).map((s) => s.type)).toEqual([
      'sermon_series',
      'verse_note',
    ]);
    expect(searchLinkables(db, { query: 'anything', types: ['saved_verse'] })).toEqual([]);
  });

  test('returns nothing for no matches', () => {
    const db = createTestDb();
    seed(db);
    expect(searchLinkables(db, { query: 'zzz', types: DEFAULT_PICKER_TYPES })).toEqual([]);
  });
});
