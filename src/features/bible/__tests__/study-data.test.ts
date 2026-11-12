/** Topical index and dictionary repository against the real bundled database. */
import { installBundledBibleForTests } from '@/features/bible/db/testing/node-executor';
import { normalizeName } from '@/features/bible/study-data/normalize';
import {
  findDictionaryEntriesByName,
  findTopicsByName,
  getDictionaryEntry,
  getTopic,
  getTopicPassages,
  searchDictionary,
  searchTopics,
} from '@/features/bible/study-data/repository';

let restore: () => void;

beforeAll(() => {
  restore = installBundledBibleForTests();
});

afterAll(() => restore());

describe('normalizeName', () => {
  it('matches the build script normalization', () => {
    expect(normalizeName('LORD’S SUPPER')).toBe('lords supper');
    expect(normalizeName('  Agrippa I. ')).toBe('agrippa i');
    expect(normalizeName('Élan—vital')).toBe('elan vital');
  });
});

describe('topics', () => {
  it('finds topics by exact name in the order asked', async () => {
    const topics = await findTopicsByName(['Worry', 'anxiety', 'no such topic', 'worry']);
    expect(topics.map((topic) => topic.name)).toEqual(['Worry', 'Anxiety']);
    expect(await findTopicsByName([])).toEqual([]);
  });

  it('searches topic names with the last word as a prefix, exact name first', async () => {
    const topics = await searchTopics('forgiv', { limit: 5 });
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.every((topic) => /forgiv/i.test(topic.name))).toBe(true);
    expect((await searchTopics('love'))[0].name).toBe('Love');
    expect(await searchTopics('  ')).toEqual([]);
  });

  it('loads a topic with voted passages, Nave subtopics and see-also links', async () => {
    const [love] = await findTopicsByName(['love']);
    const topic = await getTopic(love.id);
    expect(topic?.popular[0]).toMatchObject({ startVerseId: 46013004, source: 'openbible' });
    expect(topic?.popular[0].text).toMatch(/^Love is patient/);
    expect(topic?.sections.some((section) => section.label === 'Of man for God')).toBe(true);
    expect(topic?.sections.flatMap((section) => section.passages).every((passage) => passage.source === 'nave')).toBe(true);
    const [anxiety] = await findTopicsByName(['anxiety']);
    expect((await getTopic(anxiety.id))?.seeAlso.map((link) => link.name)).toContain('Care');
    expect(await getTopic(999_999_999)).toBeNull();
    expect(await getTopic(-1)).toBeNull();
  });

  it('returns the best passages across topics without duplicates', async () => {
    const topics = await findTopicsByName(['anxiety', 'worry']);
    const passages = await getTopicPassages(topics.map((topic) => topic.id), { limit: 10 });
    expect(passages).toHaveLength(10);
    const keys = passages.map((passage) => `${passage.startVerseId}-${passage.endVerseId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(passages[0].weight).toBeGreaterThanOrEqual(passages[9].weight);
    expect(await getTopicPassages([])).toEqual([]);
  });
});

describe('dictionary', () => {
  it('ranks the exact term first and previews the definition', async () => {
    const [first] = await searchDictionary('grace');
    expect(first.term).toBe('Grace');
    expect(first.preview.length).toBeLessThanOrEqual(161);
    expect(await searchDictionary('')).toEqual([]);
  });

  it('finds entries by name and loads the full definition', async () => {
    const [supper] = await findDictionaryEntriesByName(['Lord’s Supper']);
    expect(supper.term).toBe('Lord’s Supper');
    const entry = await getDictionaryEntry(supper.id);
    expect(entry?.definition).toContain('\n\n');
    expect(await getDictionaryEntry(0)).toBeNull();
  });
});
