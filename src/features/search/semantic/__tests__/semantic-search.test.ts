/** Concept search against the real bundled Bible database (better-sqlite3). */
import { installBundledBibleForTests } from '@/features/bible/db/testing/node-executor';

import { semanticSearchBible } from '../semantic-search';

let restore: () => void;

beforeAll(() => {
  restore = installBundledBibleForTests();
});

afterAll(() => restore());

const refs = (results: { reference: string }[]) => results.map((result) => result.reference);

describe('semanticSearchBible', () => {
  it('finds well-known passages for a feeling the text never names', async () => {
    const { results, topics, expansion } = await semanticSearchBible('worried', { limit: 30 });
    expect(expansion.alsoSearching).toEqual(expect.arrayContaining(['peace']));
    expect(topics.map((topic) => topic.name)).toEqual(expect.arrayContaining(['Worried', 'Anxiety']));
    const found = refs(results);
    expect(found.some((reference) => reference.startsWith('Philippians 4:6'))).toBe(true);
    expect(found).toContain('1 Peter 5:7');
  });

  it('ranks the exact phrase first, then verses with every word', async () => {
    const { results } = await semanticSearchBible('love your enemies', { limit: 20 });
    expect(results[0].matchedVia).toEqual({ kind: 'phrase', label: 'Exact phrase' });
    expect(refs(results.filter((result) => result.matchedVia.kind === 'phrase'))).toEqual(
      expect.arrayContaining(['Matthew 5:44', 'Luke 6:27']),
    );
    const kinds = results.map((result) => result.matchedVia.kind);
    expect(kinds.indexOf('all-words')).toBeGreaterThan(kinds.lastIndexOf('phrase'));
    const scores = results.map((result) => result.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('explains concept matches with the related word and topic matches with the topic', async () => {
    const { results } = await semanticSearchBible('anxiety', { limit: 60 });
    const concept = results.find((result) => result.matchedVia.kind === 'concept');
    expect(concept?.matchedVia.label).toMatch(/^Related word: /);
    expect(concept?.snippet).toContain('«');
    const topic = results.find((result) => result.matchedVia.kind === 'topic');
    expect(topic?.matchedVia.label).toMatch(/^Topic: /);
    expect(topic?.text.length).toBeGreaterThan(0);
  });

  it('returns topical passages (ranges) and no duplicate verses', async () => {
    const { results } = await semanticSearchBible('lonely', { limit: 40 });
    const starts = results.map((result) => result.startVerseId);
    expect(new Set(starts).size).toBe(starts.length);
    expect(results.some((result) => result.endVerseId > result.startVerseId)).toBe(true);
  });

  it('respects the testament filter and the limit', async () => {
    const { results } = await semanticSearchBible('peace', { testament: 'NT', limit: 5 });
    expect(results).toHaveLength(5);
    for (const result of results) expect(result.startVerseId).toBeGreaterThanOrEqual(40_000_000);
  });

  it('falls back to any of the words when no concept matches', async () => {
    const { results } = await semanticSearchBible('mustard tree birds', { limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.matchedVia.kind === 'some-words' || result.matchedVia.kind === 'all-words')).toBe(true);
  });

  it('returns nothing for references, nonsense and too-short queries', async () => {
    expect((await semanticSearchBible('Romans 8:28')).results).toEqual([]);
    expect((await semanticSearchBible('zzqqxx')).results).toEqual([]);
    expect((await semanticSearchBible('a')).results).toEqual([]);
    await expect(semanticSearchBible('" OR NEAR( *')).resolves.toBeDefined();
  });

  it('is fast enough for search-as-you-type', async () => {
    const queries = ['grief', 'money', 'forgiveness', 'I feel worried about money'];
    const started = Date.now();
    for (const query of queries) await semanticSearchBible(query);
    expect((Date.now() - started) / queries.length).toBeLessThan(150);
  });
});
