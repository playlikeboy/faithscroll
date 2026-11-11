import { prayerUpdates, sermonBookmarks, transcriptSegments } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import type { BibleSearchResult } from '@/features/bible/types';
import {
  seedActionItem,
  seedCollection,
  seedHighlight,
  seedJournalEntry,
  seedPrayer,
  seedReference,
  seedSavedVerse,
  seedSeries,
  seedSermon,
  seedSermonNote,
  seedTag,
  seedTranscript,
  seedVerseNote,
} from '@/features/library/testing/fixtures';

import { escapeLike, isSearchable, normalizeQuery, splitTerms } from '../query';
import { searchLibrary, searchMore, searchSavedScripture } from '../search-service';
import { makeSnippet } from '../snippet';

const DELETED = '2026-11-01T00:00:00.000Z';

function idsOf(db: AppDatabase, query: string, type: string): string[] {
  return searchLibrary(db, query).groups.find((group) => group.type === type)?.results.map((result) => result.id) ?? [];
}

describe('query helpers', () => {
  it('normalizes and splits queries into distinct lower-case terms', () => {
    expect(normalizeQuery('  power   of\nforgiveness  ')).toBe('power of forgiveness');
    expect(splitTerms('Power of POWER')).toEqual(['power', 'of']);
    expect(splitTerms('"living water" well')).toEqual(['living water', 'well']);
    expect(splitTerms('a b c d e f g h')).toHaveLength(6);
    expect(normalizeQuery('x'.repeat(500))).toHaveLength(200);
  });

  it('requires at least two characters', () => {
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable(' ab ')).toBe(true);
    expect(isSearchable('""')).toBe(false);
  });

  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('100%_sure\\')).toBe('100\\%\\_sure\\\\');
  });

  it('builds snippets around the first match', () => {
    const long = `${'Intro words here. '.repeat(10)}Forgiveness is a choice we make daily. ${'More text. '.repeat(20)}`;
    const snippet = makeSnippet(long, ['forgiveness']);
    expect(snippet).toMatch(/^…/);
    expect(snippet).toContain('Forgiveness is a choice');
    expect(snippet?.length).toBeLessThanOrEqual(142);
    expect(makeSnippet('**Bold** [12:30] grace', ['grace'])).toBe('Bold grace');
    expect(makeSnippet('nothing here', ['grace'])).toBeNull();
    expect(makeSnippet(null, ['grace'])).toBeNull();
  });
});

describe('searchLibrary — "forgiveness" across personal content', () => {
  let db: AppDatabase;
  const ids: Record<string, string> = {};

  beforeAll(() => {
    db = createTestDb();
    ids.journal = seedJournalEntry(db, { title: 'Letting go', content: 'Today I chose forgiveness over bitterness.', entryDate: '2026-11-09' });
    ids.journalDeleted = seedJournalEntry(db, { title: 'Forgiveness draft', deletedAt: DELETED });
    ids.prayer = seedPrayer(db, { title: 'For my brother', content: 'Lord, give me a heart of forgiveness.' });
    ids.series = seedSeries(db, { title: 'Living With Grace' });
    ids.sermonTitle = seedSermon(db, { title: 'The Power of Forgiveness', speaker: 'Pastor John', church: 'Grace Community Church', sermonDate: '2026-11-08', seriesId: ids.series });
    ids.sermonNotes = seedSermon(db, { title: 'Week two', sermonDate: '2026-11-01' });
    seedSermonNote(db, ids.sermonNotes, '## Main point\nForgiveness is not forgetting.');
    ids.sermonTranscript = seedSermon(db, { title: 'Week three' });
    seedTranscript(db, ids.sermonTranscript, 'and so the master forgave the debt, which is forgiveness');
    ids.verseNote = seedVerseNote(db, { startVerseId: 40018021, endVerseId: 40018022, content: 'Seventy times seven — forgiveness without limit' });
    ids.action = seedActionItem(db, { title: 'Practise forgiveness', notes: 'Call Sam this week' });
    ids.collection = seedCollection(db, { title: 'Forgiveness', description: 'Everything on forgiving' });
    ids.taggedJournal = seedJournalEntry(db, { title: 'A hard conversation', content: 'We talked for hours.' });
    seedTag(db, 'Forgiveness', [{ entityType: 'journal_entry', entityId: ids.taggedJournal }]);
  });

  it('finds matches in every type, newest first, without deleted rows', () => {
    const response = searchLibrary(db, 'forgiveness');
    expect(response.groups.map((group) => group.type)).toEqual(['journal_entry', 'prayer_entry', 'sermon', 'verse_note', 'action_item', 'collection']);
    expect(idsOf(db, 'forgiveness', 'journal_entry').sort()).toEqual([ids.journal, ids.taggedJournal].sort());
    expect(idsOf(db, 'forgiveness', 'prayer_entry')).toEqual([ids.prayer]);
    expect(idsOf(db, 'forgiveness', 'sermon')).toEqual([ids.sermonTitle, ids.sermonNotes, ids.sermonTranscript]);
    expect(idsOf(db, 'forgiveness', 'verse_note')).toEqual([ids.verseNote]);
    expect(idsOf(db, 'forgiveness', 'action_item')).toEqual([ids.action]);
    expect(idsOf(db, 'forgiveness', 'collection')).toEqual([ids.collection]);
    expect(response.tags).toEqual([expect.objectContaining({ name: 'Forgiveness', itemCount: 1 })]);
    expect(response.total).toBe(10);
    expect(JSON.stringify(response)).not.toContain(ids.journalDeleted);
  });

  it('returns display data with snippets and links', () => {
    const sermons = searchLibrary(db, 'forgiveness').groups.find((group) => group.type === 'sermon');
    expect(sermons?.results[0]).toMatchObject({
      title: 'The Power of Forgiveness',
      subtitle: expect.stringContaining('Pastor John'),
      href: `/sermons/${ids.sermonTitle}`,
    });
    expect(sermons?.results[0].subtitle).toContain('Living With Grace');
    expect(sermons?.results[1].snippet).toBe('Main point Forgiveness is not forgetting.');
    expect(sermons?.results[2].snippet).toContain('forgiveness');
    const notes = searchLibrary(db, 'forgiveness').groups.find((group) => group.type === 'verse_note');
    expect(notes?.results[0]).toMatchObject({ title: expect.stringContaining('Matthew 18:21'), href: `/bible/note/${ids.verseNote}` });
  });

  it('matches sermons by speaker, church and series', () => {
    expect(idsOf(db, 'pastor john', 'sermon')).toEqual([ids.sermonTitle]);
    expect(idsOf(db, 'community church', 'sermon')).toEqual([ids.sermonTitle]);
    expect(idsOf(db, 'living with grace', 'sermon')).toEqual([ids.sermonTitle]);
  });

  it('requires every term to match (AND across fields)', () => {
    expect(idsOf(db, 'forgiveness pastor', 'sermon')).toEqual([ids.sermonTitle]);
    expect(idsOf(db, 'forgiveness nonexistentword', 'sermon')).toEqual([]);
    expect(idsOf(db, 'practise sam', 'action_item')).toEqual([ids.action]);
  });

  it('is case-insensitive', () => {
    expect(idsOf(db, 'FORGIVENESS', 'prayer_entry')).toEqual([ids.prayer]);
  });

  it('returns nothing for too-short queries', () => {
    expect(searchLibrary(db, 'f')).toMatchObject({ groups: [], tags: [], total: 0 });
    expect(searchLibrary(db, '   ')).toMatchObject({ groups: [], passage: null });
  });
});

describe('searchLibrary — escaping, transcripts and pagination', () => {
  it('treats % and _ literally', () => {
    const db = createTestDb();
    const percent = seedJournalEntry(db, { title: 'Giving 100% of my heart' });
    seedJournalEntry(db, { title: 'Giving 100 of my heart' });
    const underscore = seedJournalEntry(db, { title: 'file_name' });
    seedJournalEntry(db, { title: 'filename' });
    expect(idsOf(db, '100%', 'journal_entry')).toEqual([percent]);
    expect(idsOf(db, 'file_name', 'journal_entry')).toEqual([underscore]);
    expect(idsOf(db, '%%', 'journal_entry')).toEqual([]);
    expect(idsOf(db, '__', 'journal_entry')).toEqual([]);
  });

  it('searches transcript segments and prayer updates', () => {
    const db = createTestDb();
    const sermon = seedSermon(db, { title: 'Untitled' });
    const transcript = seedTranscript(db, sermon, '');
    db.insert(transcriptSegments).values({ id: 'seg-1', transcriptId: transcript, startMs: 0, endMs: 1000, text: 'mercy triumphs over judgment', sortOrder: 0 }).run();
    expect(idsOf(db, 'mercy triumphs', 'sermon')).toEqual([sermon]);

    const prayer = seedPrayer(db, { title: 'Healing for Mum' });
    seedPrayer(db, { title: 'Another prayer' });
    db.insert(prayerUpdates).values({ id: 'upd-1', prayerId: prayer, content: 'The scan came back clear — thankful' }).run();
    const prayers = searchLibrary(db, 'scan came back').groups.find((group) => group.type === 'prayer_entry');
    expect(prayers?.results.map((result) => result.id)).toEqual([prayer]);
    expect(prayers?.results[0].snippet).toBe('The scan came back clear — thankful');
  });

  it('paginates each group with hasMore and searchMore', () => {
    const db = createTestDb();
    const entries = Array.from({ length: 12 }, (_, index) =>
      seedJournalEntry(db, { title: `Gratitude ${index}`, entryDate: `2026-10-${String(index + 10).padStart(2, '0')}` }),
    );
    const first = searchLibrary(db, 'gratitude').groups[0];
    expect(first.results).toHaveLength(5);
    expect(first.hasMore).toBe(true);
    expect(first.results[0].id).toBe(entries[11]);

    const second = searchMore(db, 'journal_entry', 'gratitude', 5, 5);
    expect(second.results.map((result) => result.id)).toEqual(entries.slice(2, 7).reverse());
    expect(second.hasMore).toBe(true);
    const last = searchMore(db, 'journal_entry', 'gratitude', 10, 5);
    expect(last.results).toHaveLength(2);
    expect(last.hasMore).toBe(false);
    expect(searchMore(db, 'highlight', 'gratitude', 0)).toMatchObject({ results: [], hasMore: false });
  });
});

describe('searchLibrary — Bible references', () => {
  it('returns the passage and every personal item that references it', () => {
    const db = createTestDb();
    const journal = seedJournalEntry(db, { title: 'On Romans 8' });
    seedReference(db, { sourceType: 'journal_entry', sourceId: journal, startVerseId: 45008028, endVerseId: 45008028 });
    const prayer = seedPrayer(db, { title: 'Trusting God' });
    seedReference(db, { sourceType: 'prayer_entry', sourceId: prayer, startVerseId: 45008026, endVerseId: 45008030 });
    const sermon = seedSermon(db, { title: 'All things for good' });
    const note = seedSermonNote(db, sermon, 'Romans 8:28');
    seedReference(db, { sourceType: 'sermon_note', sourceId: note, startVerseId: 45008028, endVerseId: 45008028 });
    const bookmarkSermon = seedSermon(db, { title: 'Bookmarked' });
    db.insert(sermonBookmarks).values({ id: 'bm-1', sermonId: bookmarkSermon, positionMs: 1000 }).run();
    seedReference(db, { sourceType: 'sermon_bookmark', sourceId: 'bm-1', startVerseId: 45008028, endVerseId: 45008028 });
    const mainPassage = seedSermon(db, { title: 'Romans series', mainPassageStartVerseId: 45008001, mainPassageEndVerseId: 45008039 });
    const verseNote = seedVerseNote(db, { startVerseId: 45008028, endVerseId: 45008028 });
    const saved = seedSavedVerse(db, { startVerseId: 45008028, endVerseId: 45008029 });
    seedHighlight(db, { verseId: 45008028, color: 'gold' });
    const elsewhere = seedJournalEntry(db, { title: 'Elsewhere' });
    seedReference(db, { sourceType: 'journal_entry', sourceId: elsewhere, startVerseId: 43003016, endVerseId: 43003016 });
    const deletedJournal = seedJournalEntry(db, { title: 'Deleted', deletedAt: DELETED });
    seedReference(db, { sourceType: 'journal_entry', sourceId: deletedJournal, startVerseId: 45008028, endVerseId: 45008028 });

    const { passage } = searchLibrary(db, 'Romans 8:28');
    expect(passage?.reference).toBe('Romans 8:28');
    expect(passage?.href).toBe('/bible/read/45/8?verse=28');
    const related = passage?.related.map((result) => `${result.type}:${result.id}`) ?? [];
    expect(related).toEqual(
      expect.arrayContaining([
        `journal_entry:${journal}`,
        `prayer_entry:${prayer}`,
        `sermon:${sermon}`,
        `sermon:${bookmarkSermon}`,
        `sermon:${mainPassage}`,
        `verse_note:${verseNote}`,
        `saved_verse:${saved}`,
      ]),
    );
    expect(related.some((key) => key.startsWith('highlight:'))).toBe(true);
    expect(related).not.toContain(`journal_entry:${elsewhere}`);
    expect(related).not.toContain(`journal_entry:${deletedJournal}`);
    expect(new Set(related).size).toBe(related.length);
    expect(passage?.related.find((result) => result.type === 'saved_verse')?.href).toBe('/bible/read/45/8?verse=28');
  });

  it('returns no passage for plain words', () => {
    expect(searchLibrary(createTestDb(), 'forgiveness').passage).toBeNull();
  });
});

describe('searchSavedScripture', () => {
  function verse(id: number, text: string): BibleSearchResult {
    return { verse: { id, bookId: 0, chapter: 0, verse: 0, text, heading: null, paragraphStart: false, poetry: false }, snippet: text };
  }

  it('finds saved verses and highlights whose text contains the words', async () => {
    const db = createTestDb();
    const saved = seedSavedVerse(db, { startVerseId: 40006012, endVerseId: 40006015 });
    seedSavedVerse(db, { startVerseId: 43003016, endVerseId: 43003016 });
    seedSavedVerse(db, { startVerseId: 40006014, endVerseId: 40006014, deletedAt: DELETED });
    seedHighlight(db, { verseId: 51003013, color: 'sage' });
    const bibleSearch = jest.fn(async () => [verse(40006014, 'For if you forgive men their trespasses…'), verse(51003013, 'forgiving each other')]);

    const results = await searchSavedScripture(db, 'forgive', bibleSearch);
    expect(bibleSearch).toHaveBeenCalledWith('forgive', { limit: 300 });
    expect(results.map((result) => [result.type, result.id === saved || result.type === 'highlight'])).toEqual([
      ['saved_verse', true],
      ['highlight', true],
    ]);
    expect(results[0]).toMatchObject({ snippet: 'For if you forgive men their trespasses…', href: '/bible/read/40/6?verse=12' });
  });

  it('skips the Bible search for short queries and handles no matches', async () => {
    const db = createTestDb();
    const bibleSearch = jest.fn(async () => []);
    await expect(searchSavedScripture(db, 'f', bibleSearch)).resolves.toEqual([]);
    expect(bibleSearch).not.toHaveBeenCalled();
    await expect(searchSavedScripture(db, 'forgive', bibleSearch)).resolves.toEqual([]);
  });
});
