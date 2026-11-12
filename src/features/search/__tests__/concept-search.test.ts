/**
 * Concept expansion in universal search: personal notes match synonyms, and the Bible sections
 * come from the real bundled database.
 */
import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import { installBundledBibleForTests } from '@/features/bible/db/testing/node-executor';
import { seedJournalEntry, seedPrayer } from '@/features/library/testing/fixtures';

import { searchBibleSections } from '../bible-sections';
import { allTermsMatch, expandTerms } from '../query';
import { searchLibrary, searchMore, termGroupsFor } from '../search-service';

let db: AppDatabase;
let restore: () => void;

beforeAll(() => {
  restore = installBundledBibleForTests();
  db = createTestDb();
  seedJournalEntry(db, { title: 'Sleepless night', content: 'So much worry about the move.' });
  seedJournalEntry(db, { title: 'Grateful', content: 'A calm morning walk.' });
  seedPrayer(db, { title: 'Anxious about results', content: 'Waiting for the scan.' });
});

afterAll(() => restore());

describe('term expansion', () => {
  it('pairs each term with its synonyms', () => {
    const groups = termGroupsFor('anxiety morning');
    expect(groups[0][0]).toBe('anxiety');
    expect(groups[0]).toEqual(expect.arrayContaining(['worry', 'anxious']));
    expect(groups[1]).toEqual(['morning']);
    expect(expandTerms(['x'], () => [])).toEqual([['x']]);
  });

  it('still accepts plain string terms', () => {
    expect(() => allTermsMatch(['grace', ['hope', 'expectation']], () => [])).not.toThrow();
  });
});

describe('searchLibrary with concepts', () => {
  it('finds notes that use a synonym of the query', () => {
    const response = searchLibrary(db, 'anxiety');
    const journal = response.groups.find((group) => group.type === 'journal_entry');
    const prayers = response.groups.find((group) => group.type === 'prayer_entry');
    expect(journal?.results.map((result) => result.title)).toEqual(['Sleepless night']);
    expect(journal?.results[0].snippet).toContain('worry');
    expect(prayers?.results.map((result) => result.title)).toEqual(['Anxious about results']);
    expect(response.alsoSearching).toEqual(expect.arrayContaining(['worry', 'peace']));
  });

  it('keeps AND semantics across terms and expands "Show more" the same way', () => {
    expect(searchLibrary(db, 'anxiety morning').groups).toEqual([]);
    expect(searchMore(db, 'journal_entry', 'anxiety', 0).results.map((result) => result.title)).toEqual(['Sleepless night']);
  });

  it('does not suggest related words for Bible references', () => {
    expect(searchLibrary(db, 'Romans 8:28').alsoSearching).toEqual([]);
  });
});

describe('searchBibleSections', () => {
  it('returns verses, topics and dictionary entries for a concept', async () => {
    const sections = await searchBibleSections('grace');
    expect(sections.verses.length).toBeGreaterThan(0);
    expect(sections.verses.length).toBeLessThanOrEqual(6);
    expect(sections.topics.map((topic) => topic.name)).toContain('Grace');
    expect(sections.dictionary[0]?.term).toBe('Grace');
    expect(sections.alsoSearching.length).toBeGreaterThan(0);
  });

  it('is empty for short queries', async () => {
    expect(await searchBibleSections(' a ')).toMatchObject({ verses: [], topics: [], dictionary: [] });
  });
});
