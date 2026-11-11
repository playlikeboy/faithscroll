import { findBook, findReferences, formatReference, parseReference } from '@/features/bible/reference';
import type { VerseRange } from '@/features/bible/types';
import { getVerseCount } from '@/features/bible/repository';

function range(bookId: number, chapter: number, verse: number, endChapter = chapter, endVerse = verse): VerseRange {
  return { start: { bookId, chapter, verse }, end: { bookId, chapter: endChapter, verse: endVerse } };
}

describe('parseReference', () => {
  test.each([
    ['John 3:16', range(43, 3, 16)],
    ['Romans 8:28', range(45, 8, 28)],
    ['Rom 8:28', range(45, 8, 28)],
    ['rom. 8:28', range(45, 8, 28)],
    ['  ROMANS   8 : 28  ', range(45, 8, 28)],
    ['Gen 1:1', range(1, 1, 1)],
    ['Ps 23:1', range(19, 23, 1)],
    ['Psa 23:1', range(19, 23, 1)],
    ['Psalm 23:1', range(19, 23, 1)],
    ['Psalms 23:1', range(19, 23, 1)],
    ['Song of Solomon 2:4', range(22, 2, 4)],
    ['Song of Songs 2:4', range(22, 2, 4)],
    ['Canticles 2:4', range(22, 2, 4)],
    ['1 Cor 13:4', range(46, 13, 4)],
    ['1st Corinthians 13:4', range(46, 13, 4)],
    ['I Corinthians 13:4', range(46, 13, 4)],
    ['First Corinthians 13:4', range(46, 13, 4)],
    ['1Co 13:4', range(46, 13, 4)],
    ['1Cor13:4', range(46, 13, 4)],
    ['II Cor 5:17', range(47, 5, 17)],
    ['2nd Corinthians 5:17', range(47, 5, 17)],
    ['Jn 3:16', range(43, 3, 16)],
    ['1 Jn 4:8', range(62, 4, 8)],
    ['1 John 4:8', range(62, 4, 8)],
    ['Matt 5:3', range(40, 5, 3)],
    ['Mt 5:3', range(40, 5, 3)],
    ['Mk 1:1', range(41, 1, 1)],
    ['Phil 4:13', range(50, 4, 13)],
    ['Php 4:13', range(50, 4, 13)],
    ['Phlm 6', range(57, 1, 6)],
    ['Philemon 1:6', range(57, 1, 6)],
    ['Jude 3', range(65, 1, 3)],
    ['Jude 1:24', range(65, 1, 24)],
    ['3 John 4', range(64, 1, 4)],
    ['Rev 21:4', range(66, 21, 4)],
    ['Revelation 21:4', range(66, 21, 4)],
    ['Revelations 21:4', range(66, 21, 4)],
    ['John 3.16', range(43, 3, 16)],
    ['Rom 8:28a', range(45, 8, 28)],
    ['Job 1:21', range(18, 1, 21)],
    ['Acts 2:38', range(44, 2, 38)],
    ['Mark 10:45', range(41, 10, 45)],
  ])('parses %s', (input, expected) => {
    expect(parseReference(input)).toEqual(expected);
  });

  test('parses verse ranges with hyphen, en dash and em dash', () => {
    expect(parseReference('Rom 8:28-30')).toEqual(range(45, 8, 28, 8, 30));
    expect(parseReference('Rom 8:28–30')).toEqual(range(45, 8, 28, 8, 30));
    expect(parseReference('Rom 8:28 — 30')).toEqual(range(45, 8, 28, 8, 30));
    expect(parseReference('Jude 24-25')).toEqual(range(65, 1, 24, 1, 25));
  });

  test('parses cross-chapter ranges', () => {
    expect(parseReference('Ps 23:1-24:2')).toEqual(range(19, 23, 1, 24, 2));
    expect(parseReference('Genesis 1:1–2:3')).toEqual(range(1, 1, 1, 2, 3));
  });

  test('a whole chapter spans verse 1 to the last verse', () => {
    expect(parseReference('John 3')).toEqual(range(43, 3, 1, 3, 36));
    expect(parseReference('Psalm 117')).toEqual(range(19, 117, 1, 117, 2));
    expect(parseReference('Genesis 1-3')).toEqual(range(1, 1, 1, 3, 24));
  });

  test('a bare book name is the whole book', () => {
    expect(parseReference('Jude')).toEqual(range(65, 1, 1, 1, 25));
    expect(parseReference('Romans')).toEqual(range(45, 1, 1, 16, getVerseCount(45, 16)));
  });

  test('parses spoken forms', () => {
    expect(parseReference('Romans chapter 8 verse 28')).toEqual(range(45, 8, 28));
    expect(parseReference('Romans 8 verses 28 to 30')).toEqual(range(45, 8, 28, 8, 30));
    expect(parseReference('John chapter three verse sixteen')).toEqual(range(43, 3, 16));
  });

  test.each([
    [''],
    ['   '],
    ['John'.repeat(3)],
    ['Foo 1:1'],
    ['John 22:1'],
    ['John 3:37'],
    ['Gen 0:1'],
    ['Gen 1:0'],
    ['Rom 8:30-28'],
    ['Ps 151'],
    ['Jude 2:1'],
    ['3 John 1:15'],
    ['John 3:16 extra words'],
    ['4 John 1:1'],
    ['Romans 8:28-9'],
  ])('returns null for %p', (input) => {
    expect(parseReference(input)).toBeNull();
  });
});

describe('formatReference', () => {
  test('formats single verses, ranges and chapters', () => {
    expect(formatReference(range(43, 3, 16))).toBe('John 3:16');
    expect(formatReference(range(40, 18, 21, 18, 35))).toBe('Matthew 18:21–35');
    expect(formatReference(range(43, 3, 1, 3, 36))).toBe('John 3');
    expect(formatReference(range(1, 1, 1, 3, 24))).toBe('Genesis 1–3');
    expect(formatReference(range(19, 23, 1, 24, 2))).toBe('Psalms 23:1–24:2');
    expect(formatReference(range(19, 23, 1, 23, 6))).toBe('Psalm 23');
    expect(formatReference(range(19, 23, 1))).toBe('Psalm 23:1');
  });

  test('short style uses abbreviations', () => {
    expect(formatReference(range(45, 8, 28), { short: true })).toBe('Rom 8:28');
    expect(formatReference(range(46, 13, 4, 13, 7), { short: true })).toBe('1 Cor 13:4–7');
    expect(formatReference(range(19, 23, 1, 23, 6), { short: true })).toBe('Ps 23');
  });

  test('single-chapter books and whole books', () => {
    expect(formatReference(range(65, 1, 3))).toBe('Jude 1:3');
    expect(formatReference(range(65, 1, 1, 1, 25))).toBe('Jude');
    expect(formatReference(range(45, 1, 1, 16, getVerseCount(45, 16)))).toBe('Romans');
  });

  test('round-trips through parseReference', () => {
    for (const input of ['John 3:16', 'Matthew 18:21–35', 'John 3', 'Psalms 23:1–24:2', 'Jude 1:3', 'Jude', 'Genesis 1–3']) {
      const parsed = parseReference(input);
      expect(parsed).not.toBeNull();
      expect(formatReference(parsed as VerseRange)).toBe(input);
    }
  });

  test('cross-book ranges and unknown books', () => {
    expect(formatReference({ start: { bookId: 1, chapter: 50, verse: 26 }, end: { bookId: 2, chapter: 1, verse: 1 } })).toBe(
      'Genesis 50:26–Exodus 1:1',
    );
    expect(formatReference(range(99, 1, 1))).toBe('');
  });
});

describe('findReferences', () => {
  test('finds written references with positions', () => {
    const text = 'Read John 3:16 and Rom 8:28-30 today.';
    const found = findReferences(text);
    expect(found.map((item) => item.range)).toEqual([range(43, 3, 16), range(45, 8, 28, 8, 30)]);
    expect(found.map((item) => item.text)).toEqual(['John 3:16', 'Rom 8:28-30']);
    for (const item of found) expect(text.slice(item.index, item.index + item.length)).toBe(item.text);
  });

  test('finds spoken references', () => {
    expect(findReferences('As Paul says in Romans chapter 8 verse 28, all things work').map((item) => item.range)).toEqual([
      range(45, 8, 28),
    ]);
    expect(findReferences('turn to Romans 8 verses 28 to 30 with me').map((item) => item.range)).toEqual([
      range(45, 8, 28, 8, 30),
    ]);
    expect(findReferences('the famous John three sixteen').map((item) => item.range)).toEqual([range(43, 3, 16)]);
    expect(findReferences('First Corinthians chapter thirteen is about love').map((item) => item.range)).toEqual([
      range(46, 13, 1, 13, 13),
    ]);
    expect(findReferences('We read Psalm twenty-three together').map((item) => item.range)).toEqual([
      range(19, 23, 1, 23, 6),
    ]);
    expect(findReferences('Romans chapter 8, verses 28 and 29').map((item) => item.range)).toEqual([
      range(45, 8, 28, 8, 29),
    ]);
  });

  test('finds whole chapters for capitalised book names', () => {
    expect(findReferences('In Acts 2 Peter preaches').map((item) => item.range)).toEqual([range(44, 2, 1, 2, 47)]);
    expect(findReferences('Mark 4 has parables').map((item) => item.range)).toEqual([range(41, 4, 1, 4, 41)]);
    expect(findReferences('Jude 3 urges us').map((item) => item.range)).toEqual([range(65, 1, 3)]);
  });

  test('finds continuation verses after commas and semicolons', () => {
    const found = findReferences('See John 3:16, 18; 4:24.');
    expect(found.map((item) => item.range)).toEqual([range(43, 3, 16), range(43, 3, 18), range(43, 4, 24)]);
    expect(found.map((item) => item.text)).toEqual(['John 3:16', '18', '4:24']);
  });

  test('finds several books in a list', () => {
    expect(findReferences('Romans 12:2; 2 Cor 5:17; Gal 2:20').map((item) => item.range)).toEqual([
      range(45, 12, 2),
      range(47, 5, 17),
      range(48, 2, 20),
    ]);
  });

  test.each([
    ['Mark said hello to everyone'],
    ['Job was a patient man'],
    ['the acts of the apostles were many'],
    ['I will mark 5 papers tonight'],
    ['we met at 10:30 today'],
    ['it is 3:15 now'],
    ['Numbers 1 through 3 are on the list'],
    ['John 30:1 does not exist'],
    ['Then I John saw the holy city'],
    ['Romans 8:28, 3 people came'],
  ])('ignores false positives in %p', (text) => {
    const found = findReferences(text);
    if (text.startsWith('Romans 8:28')) expect(found.map((item) => item.text)).toEqual(['Romans 8:28']);
    else expect(found).toEqual([]);
  });

  test('reads hundreds in spoken numbers', () => {
    expect(findReferences('Psalm one hundred and nineteen verse one hundred and five').map((item) => item.range)).toEqual([
      range(19, 119, 105),
    ]);
    expect(findReferences('Psalm one hundred nineteen').map((item) => item.range)).toEqual([range(19, 119, 1, 119, 176)]);
  });

  test('ignores verses the translation omits and spoken bare chapters outside Psalms', () => {
    expect(findReferences('Acts 8:37')).toEqual([]);
    expect(findReferences('Mark one thing')).toEqual([]);
    expect(findReferences('see John 3:16am')).toEqual([]);
  });

  test('accepts lowercase book names only with a verse', () => {
    expect(findReferences('see rom 8:28 here').map((item) => item.range)).toEqual([range(45, 8, 28)]);
    expect(findReferences('see rom 8 here')).toEqual([]);
  });

  test('returns an empty list for empty text', () => {
    expect(findReferences('')).toEqual([]);
  });
});

describe('findBook', () => {
  test('resolves names and abbreviations', () => {
    expect(findBook('Psalms')?.id).toBe(19);
    expect(findBook('1 cor')?.id).toBe(46);
    expect(findBook('Song of Songs')?.id).toBe(22);
    expect(findBook('nope')).toBeUndefined();
  });
});
