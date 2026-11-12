import { CONCEPTS } from '../concepts';
import { conceptKey, expandQuery, getConcept, synonymsFor } from '../expand';
import { stem } from '../stem';

describe('stem', () => {
  it('folds common inflections onto one stem', () => {
    expect(new Set(['worry', 'worried', 'worries', 'worrying'].map(stem))).toEqual(new Set(['worri']));
    expect(new Set(['love', 'loved', 'loving', 'loves'].map(stem)).size).toBe(1);
    expect(stem('loneliness')).toBe(stem('lonely'));
    expect(stem('forgiveness')).toBe(stem('forgive'));
    expect(stem('peaceful')).toBe(stem('peace'));
  });

  it('leaves short words, -ss and -us endings alone', () => {
    expect(stem('is')).toBe('is');
    expect(stem('stress')).toBe('stress');
    expect(stem('Jesus')).toBe('jesus');
    expect(stem('God’s')).toBe('god');
  });
});

describe('concept map', () => {
  it('has about 150 concepts with unique keys and resolvable related concepts', () => {
    expect(CONCEPTS.length).toBeGreaterThanOrEqual(150);
    const keys = CONCEPTS.map((concept) => conceptKey(concept.label));
    expect(new Set(keys).size).toBe(keys.length);
    const dangling = CONCEPTS.flatMap((concept) =>
      concept.related.filter((related) => !getConcept(related)).map((related) => `${concept.label} → ${related}`),
    );
    expect(dangling).toEqual([]);
    expect(CONCEPTS.every((concept) => concept.terms.length > 0)).toBe(true);
  });
});

describe('expandQuery', () => {
  it('expands anxiety into synonyms and related concepts', () => {
    const expansion = expandQuery('anxiety');
    expect(expansion.concepts.map((concept) => concept.label)).toEqual(['Anxiety']);
    expect(expansion.coreTerms).toEqual(expect.arrayContaining(['anxious', 'worry', 'troubled']));
    expect(expansion.relatedTerms).toEqual(expect.arrayContaining(['peace', 'trust', 'rest']));
    expect(expansion.alsoSearching).toEqual(expect.arrayContaining(['worry', 'peace', 'rest']));
    expect(expansion.alsoSearching).not.toContain('anxiety');
    expect(expansion.alsoSearching.length).toBeLessThanOrEqual(5);
  });

  it('matches inflected words and ignores stop words', () => {
    const expansion = expandQuery('What does the Bible say when I feel worried?');
    expect(expansion.concepts.map((concept) => concept.key)).toEqual(['anxiety']);
    expect(expansion.keywords).toEqual(['worried']);
    expect(expansion.coreTerms).not.toContain('worried');
  });

  it('prefers multi-word concepts and caps the number of concepts', () => {
    expect(expandQuery('love of God').concepts[0]?.key).toBe('love of god');
    expect(expandQuery('grief anger fear doubt money').concepts).toHaveLength(3);
  });

  it('maps everyday words to the right concepts', () => {
    const cases: [string, string][] = [
      ['mourning', 'grief'],
      ['lonely', 'loneliness'],
      ['job', 'work'],
      ['husband', 'marriage'],
      ['tired', 'weariness'],
      ['forgiving', 'forgiveness'],
    ];
    for (const [query, key] of cases) expect(expandQuery(query).concepts.map((concept) => concept.key)).toContain(key);
  });

  it('returns no concepts for unknown words and keeps topic names', () => {
    const expansion = expandQuery('  living   water ');
    expect(expansion.query).toBe('living water');
    expect(expansion.concepts).toEqual([]);
    expect(expansion.alsoSearching).toEqual([]);
    expect(expansion.topicNames).toEqual(expect.arrayContaining(['living water', 'living', 'water']));
  });
});

describe('synonymsFor', () => {
  it('returns the term first, then close synonyms', () => {
    const synonyms = synonymsFor('Anxiety');
    expect(synonyms[0]).toBe('anxiety');
    expect(synonyms).toEqual(expect.arrayContaining(['anxious', 'worry']));
    expect(synonyms.length).toBeLessThanOrEqual(6);
  });

  it('returns only the term when it names no concept', () => {
    expect(synonymsFor('sermon')).toEqual(['sermon']);
    expect(synonymsFor('  ')).toEqual([]);
  });
});
