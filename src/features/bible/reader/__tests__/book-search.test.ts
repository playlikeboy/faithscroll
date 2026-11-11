import { filterBooks } from '@/features/bible/reader/book-search';
import { formatReadAt } from '@/features/bible/reader/format';

jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));

describe('filterBooks', () => {
  test('returns the testament when the query is empty', () => {
    expect(filterBooks('', 'OT')).toHaveLength(39);
    expect(filterBooks('  ', 'NT')).toHaveLength(27);
  });

  test('searches the whole Bible by name, abbreviation or code', () => {
    expect(filterBooks('john', 'OT').map((b) => b.name)).toEqual(['John', '1 John', '2 John', '3 John']);
    expect(filterBooks('1 cor', 'OT').map((b) => b.name)).toEqual(['1 Corinthians']);
    expect(filterBooks('1cor', 'OT').map((b) => b.name)).toEqual(['1 Corinthians']);
    expect(filterBooks('Psalm', 'NT').map((b) => b.name)).toEqual(['Psalms']);
    expect(filterBooks('rom', 'OT').map((b) => b.name)).toEqual(['Romans']);
    expect(filterBooks('zzz', 'OT')).toEqual([]);
  });
});

describe('formatReadAt', () => {
  const now = new Date(2026, 10, 11, 9, 0);

  test('uses Today and Yesterday, then a short date', () => {
    expect(formatReadAt(new Date(2026, 10, 11, 7, 0).toISOString(), now)).toBe('Today');
    expect(formatReadAt(new Date(2026, 10, 10, 23, 0).toISOString(), now)).toBe('Yesterday');
    expect(formatReadAt(new Date(2026, 10, 2, 12, 0).toISOString(), now)).toMatch(/2/);
    expect(formatReadAt(null, now)).toBe('');
    expect(formatReadAt('nope', now)).toBe('');
  });
});
