import { toFtsAnyQuery, toFtsPhraseQuery, toFtsPrefixQuery, toFtsQuery } from '@/features/bible/db/fts-query';

describe('FTS query builders', () => {
  it('quotes every word so operators are plain text', () => {
    expect(toFtsQuery('love NEAR enemies')).toBe('"love" "NEAR" "enemies"');
    expect(toFtsQuery('  ')).toBeNull();
  });

  it('adds a prefix wildcard to the last bare word only', () => {
    expect(toFtsPrefixQuery('lords sup')).toBe('"lords" "sup"*');
    expect(toFtsPrefixQuery('"holy spirit"')).toBe('"holy spirit"');
    expect(toFtsPrefixQuery('anx-')).toBe('"anx-"');
    expect(toFtsPrefixQuery('')).toBeNull();
  });

  it('ORs distinct words and phrases', () => {
    expect(toFtsAnyQuery(['worry', 'peace', 'worry', 'steadfast love', '!!'])).toBe('"worry" OR "peace" OR "steadfast love"');
    expect(toFtsAnyQuery([])).toBeNull();
  });

  it('builds an exact phrase for multi-word input only', () => {
    expect(toFtsPhraseQuery('love your "enemies"')).toBe('"love your enemies"');
    expect(toFtsPhraseQuery('love')).toBeNull();
  });
});
