import { checkScriptureReference, clampSeconds, createReferenceChecker, filterValidReferences } from '../validation';
import { formatReference, parseReference } from '@/features/bible/reference';
import { getVerses } from '@/features/bible/repository';
import type { Verse, VerseRange } from '@/features/bible/types';

jest.mock('@/features/bible/reference', () => ({
  parseReference: jest.fn(),
  formatReference: jest.fn(),
}));
jest.mock('@/features/bible/repository', () => ({ getVerses: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const ROMANS_8_28: VerseRange = { start: { bookId: 45, chapter: 8, verse: 28 }, end: { bookId: 45, chapter: 8, verse: 28 } };
const JOHN_3_16_17: VerseRange = { start: { bookId: 43, chapter: 3, verse: 16 }, end: { bookId: 43, chapter: 3, verse: 17 } };
const JOHN_3_16_99: VerseRange = { start: { bookId: 43, chapter: 3, verse: 16 }, end: { bookId: 43, chapter: 3, verse: 99 } };

function verse(bookId: number, chapter: number, n: number): Verse {
  return { id: bookId * 1_000_000 + chapter * 1_000 + n, bookId, chapter, verse: n, text: 'text', heading: null, paragraphStart: false, poetry: false };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(parseReference).mockImplementation((input: string) => {
    if (input === 'Romans 8:28' || input === 'Rom 8:28') return ROMANS_8_28;
    if (input === 'John 3:16-17') return JOHN_3_16_17;
    if (input === 'John 3:16-99') return JOHN_3_16_99;
    return null;
  });
  jest.mocked(formatReference).mockImplementation((range: VerseRange) =>
    range === ROMANS_8_28 ? 'Romans 8:28' : 'John 3:16–17',
  );
  jest.mocked(getVerses).mockImplementation(async (range: VerseRange) => {
    if (range === ROMANS_8_28) return [verse(45, 8, 28)];
    if (range === JOHN_3_16_17) return [verse(43, 3, 16), verse(43, 3, 17)];
    if (range === JOHN_3_16_99) return [verse(43, 3, 16), verse(43, 3, 36)];
    return [];
  });
});

describe('checkScriptureReference', () => {
  test('returns the canonical reference and verse ids when the passage exists', async () => {
    await expect(checkScriptureReference('Rom 8:28')).resolves.toEqual({
      reference: 'Romans 8:28',
      range: ROMANS_8_28,
      startVerseId: 45008028,
      endVerseId: 45008028,
    });
  });

  test('rejects text that does not parse', async () => {
    await expect(checkScriptureReference('Hezekiah 4:1')).resolves.toBeNull();
    expect(getVerses).not.toHaveBeenCalled();
  });

  test('rejects ranges whose end verse does not exist', async () => {
    await expect(checkScriptureReference('John 3:16-99')).resolves.toBeNull();
  });

  test('rejects references when the Bible lookup fails', async () => {
    jest.mocked(getVerses).mockRejectedValueOnce(new Error('db closed'));
    await expect(checkScriptureReference('Romans 8:28')).resolves.toBeNull();
  });
});

describe('filterValidReferences', () => {
  test('keeps verified items with canonical text, drops the rest and counts them', async () => {
    const items = [
      { reference: 'Rom 8:28', note: 'a' },
      { reference: 'Hezekiah 4:1', note: 'invented' },
      { reference: 'John 3:16-17', note: 'b' },
      { reference: 'Rom 8:28', note: 'repeat' },
    ];
    const result = await filterValidReferences(
      items,
      (item) => item.reference,
      (item, ref) => ({ ...item, reference: ref.reference, startVerseId: ref.startVerseId }),
    );
    expect(result.dropped).toBe(1);
    expect(result.items).toEqual([
      { reference: 'Romans 8:28', note: 'a', startVerseId: 45008028 },
      { reference: 'John 3:16–17', note: 'b', startVerseId: 43003016 },
      { reference: 'Romans 8:28', note: 'repeat', startVerseId: 45008028 },
    ]);
    // Lookups are cached per call: "Rom 8:28" is resolved once.
    expect(parseReference).toHaveBeenCalledTimes(3);
  });

  test('createReferenceChecker caches results', async () => {
    const check = createReferenceChecker();
    await check('Romans 8:28');
    await check('Romans 8:28');
    expect(getVerses).toHaveBeenCalledTimes(1);
  });
});

describe('clampSeconds', () => {
  test('clamps into the recording length', () => {
    expect(clampSeconds(-4, 600)).toBe(0);
    expect(clampSeconds(30.6, 600)).toBe(30.6);
    expect(clampSeconds(900, 600)).toBe(600);
  });

  test('returns null when there is no recording or the value is unusable', () => {
    expect(clampSeconds(30, null)).toBeNull();
    expect(clampSeconds(30, 0)).toBeNull();
    expect(clampSeconds(null, 600)).toBeNull();
    expect(clampSeconds(Number.NaN, 600)).toBeNull();
  });
});
