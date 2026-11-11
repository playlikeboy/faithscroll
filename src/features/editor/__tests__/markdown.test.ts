import { findReferences } from '@/features/bible/reference';
import type { FoundReference } from '@/features/bible/types';

import { inlineToPlainText } from '../inline';
import { extractTimestamps, parseInline, parseNote, toPlainText, type NoteInline } from '../markdown';

jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const BOOK_IDS: Record<string, number> = { John: 43, Romans: 45 };

/** Minimal stand-in for the bible-data agent's detector: "<Book> <chapter>:<verse>". */
function fakeFindReferences(text: string): FoundReference[] {
  return [...text.matchAll(/\b(John|Romans) (\d+):(\d+)/g)].map((match) => {
    const ref = { bookId: BOOK_IDS[match[1]], chapter: Number(match[2]), verse: Number(match[3]) };
    return { range: { start: ref, end: ref }, text: match[0], index: match.index, length: match[0].length };
  });
}

jest.mock('@/features/bible/reference', () => ({ findReferences: jest.fn() }));
const mockedFind = findReferences as jest.MockedFunction<typeof findReferences>;

beforeEach(() => {
  mockedFind.mockReset();
  mockedFind.mockImplementation(fakeFindReferences);
});

const text = (value: string): NoteInline => ({ type: 'text', text: value });

describe('parseNote blocks', () => {
  test('empty and whitespace-only content has no blocks', () => {
    expect(parseNote('')).toEqual([]);
    expect(parseNote('\n \n\t\n')).toEqual([]);
  });

  test('parses three heading levels', () => {
    expect(parseNote('# One\n## Two\n### Three')).toEqual([
      { type: 'heading', level: 1, children: [text('One')] },
      { type: 'heading', level: 2, children: [text('Two')] },
      { type: 'heading', level: 3, children: [text('Three')] },
    ]);
  });

  test('treats deeper, unspaced or empty headings as paragraph text', () => {
    expect(parseNote('#### Four')).toEqual([{ type: 'paragraph', children: [text('#### Four')] }]);
    expect(parseNote('#hashtag')).toEqual([{ type: 'paragraph', children: [text('#hashtag')] }]);
    expect(parseNote('# ')).toEqual([{ type: 'paragraph', children: [text('# ')] }]);
  });

  test('keeps line breaks inside a paragraph and splits on blank lines', () => {
    expect(parseNote('line one\nline two\n\nnext para')).toEqual([
      { type: 'paragraph', children: [text('line one\nline two')] },
      { type: 'paragraph', children: [text('next para')] },
    ]);
  });

  test('handles CRLF and CR line endings', () => {
    expect(parseNote('# Title\r\nbody\rmore')).toEqual([
      { type: 'heading', level: 1, children: [text('Title')] },
      { type: 'paragraph', children: [text('body\nmore')] },
    ]);
  });

  test('groups - and * bullets into one list', () => {
    expect(parseNote('- one\n* two\n-   three')).toEqual([
      { type: 'bulletList', items: [[text('one')], [text('two')], [text('three')]] },
    ]);
  });

  test('keeps empty list items while typing', () => {
    expect(parseNote('- one\n- ')).toEqual([{ type: 'bulletList', items: [[text('one')], []] }]);
  });

  test('parses numbered lists with their start number', () => {
    expect(parseNote('3. three\n4. four')).toEqual([
      { type: 'numberedList', start: 3, items: [[text('three')], [text('four')]] },
    ]);
  });

  test('splits lists of different kinds and following paragraphs', () => {
    expect(parseNote('- a\n1. b\ntext\n- c').map((block) => block.type)).toEqual([
      'bulletList',
      'numberedList',
      'paragraph',
      'bulletList',
    ]);
  });

  test('does not treat bold at line start or a dash without space as a bullet', () => {
    expect(parseNote('**bold** start')[0].type).toBe('paragraph');
    expect(parseNote('-dash')[0]).toEqual({ type: 'paragraph', children: [text('-dash')] });
    expect(parseNote('1.5 litres')[0].type).toBe('paragraph');
  });

  test('parses inline formatting inside headings and list items', () => {
    expect(parseNote('## The **main** point\n- *one*')).toEqual([
      { type: 'heading', level: 2, children: [text('The '), { type: 'bold', children: [text('main')] }, text(' point')] },
      { type: 'bulletList', items: [[{ type: 'italic', children: [text('one')] }]] },
    ]);
  });
});

describe('parseInline emphasis', () => {
  test('bold, italic and highlight', () => {
    expect(parseInline('**b** *i* _u_ ==h==')).toEqual([
      { type: 'bold', children: [text('b')] },
      text(' '),
      { type: 'italic', children: [text('i')] },
      text(' '),
      { type: 'italic', children: [text('u')] },
      text(' '),
      { type: 'highlight', children: [text('h')] },
    ]);
  });

  test('__double underscore__ is bold', () => {
    expect(parseInline('__b__')).toEqual([{ type: 'bold', children: [text('b')] }]);
  });

  test('nests bold and italic', () => {
    // Same nesting as CommonMark: <em><strong>both</strong></em>.
    expect(parseInline('***both***')).toEqual([
      { type: 'italic', children: [{ type: 'bold', children: [text('both')] }] },
    ]);
    expect(parseInline('**bold *it* bold**')).toEqual([
      { type: 'bold', children: [text('bold '), { type: 'italic', children: [text('it')] }, text(' bold')] },
    ]);
    expect(parseInline('*it **b** it*')).toEqual([
      { type: 'italic', children: [text('it '), { type: 'bold', children: [text('b')] }, text(' it')] },
    ]);
    expect(parseInline('==**key** words==')).toEqual([
      { type: 'highlight', children: [{ type: 'bold', children: [text('key')] }, text(' words')] },
    ]);
  });

  test('renders unclosed markers literally', () => {
    expect(parseInline('**bold')).toEqual([text('**bold')]);
    expect(parseInline('*a')).toEqual([text('*a')]);
    expect(parseInline('==hi')).toEqual([text('==hi')]);
    // CommonMark: *<em>a <em>b</em></em>
    expect(parseInline('**a *b**')).toEqual([
      text('*'),
      { type: 'italic', children: [text('a '), { type: 'italic', children: [text('b')] }] },
    ]);
    expect(parseInline('*a _b* c_')).toEqual([{ type: 'italic', children: [text('a _b')] }, text(' c_')]);
  });

  test('ignores markers surrounded by whitespace or inside words', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([text('2 * 3 * 4')]);
    expect(parseInline('snake_case_word')).toEqual([text('snake_case_word')]);
    expect(parseInline('a == b')).toEqual([text('a == b')]);
    expect(parseInline('****')).toEqual([text('****')]);
    expect(parseInline('a = b')).toEqual([text('a = b')]);
  });

  test('allows intraword asterisks', () => {
    expect(parseInline('un*frigging*believable')).toEqual([
      text('un'),
      { type: 'italic', children: [text('frigging')] },
      text('believable'),
    ]);
  });

  test('emphasis can span lines within a paragraph', () => {
    expect(parseInline('**one\ntwo**')).toEqual([{ type: 'bold', children: [text('one\ntwo')] }]);
  });
});

describe('parseInline tokens', () => {
  test('parses mm:ss and h:mm:ss timestamps', () => {
    expect(parseInline('at [04:32] and [1:02:07]')).toEqual([
      text('at '),
      { type: 'timestamp', text: '04:32', positionMs: 272_000 },
      text(' and '),
      { type: 'timestamp', text: '1:02:07', positionMs: 3_727_000 },
    ]);
  });

  test('leaves invalid or unclosed timestamps as text', () => {
    expect(parseInline('[4:75] [04:32 [ab:cd] [123:45]')).toEqual([text('[4:75] [04:32 [ab:cd] [123:45]')]);
  });

  test('finds timestamps inside formatting', () => {
    expect(parseInline('**[00:05]**')).toEqual([
      { type: 'bold', children: [{ type: 'timestamp', text: '00:05', positionMs: 5_000 }] },
    ]);
  });

  test('detects Scripture references', () => {
    const ref = { bookId: 45, chapter: 8, verse: 28 };
    expect(parseInline('Read Romans 8:28 today')).toEqual([
      text('Read '),
      { type: 'reference', text: 'Romans 8:28', range: { start: ref, end: ref } },
      text(' today'),
    ]);
  });

  test('detects references inside highlights and next to timestamps', () => {
    const nodes = parseInline('==John 3:16== [10:00] Romans 5:8');
    expect(nodes.map((node) => node.type)).toEqual(['highlight', 'text', 'timestamp', 'text', 'reference']);
    expect(nodes[0]).toEqual({
      type: 'highlight',
      children: [
        { type: 'reference', text: 'John 3:16', range: expect.objectContaining({ start: { bookId: 43, chapter: 3, verse: 16 } }) },
      ],
    });
  });

  test('can skip reference detection', () => {
    const nodes = parseInline('Romans 8:28 at [00:01]', { detectReferences: false });
    expect(nodes.map((node) => node.type)).toEqual(['text', 'timestamp']);
    expect(parseNote('# Romans 8:28', { detectReferences: false })).toEqual([
      { type: 'heading', level: 1, children: [text('Romans 8:28')] },
    ]);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  test('survives a throwing reference detector', () => {
    mockedFind.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(parseInline('Romans 8:28')).toEqual([text('Romans 8:28')]);
  });

  test('ignores out-of-range and overlapping detector results', () => {
    const ref = { bookId: 1, chapter: 1, verse: 1 };
    const range = { start: ref, end: ref };
    mockedFind.mockReturnValue([
      { range, text: 'Gen 1:1', index: 0, length: 7 },
      { range, text: 'overlap', index: 3, length: 5 },
      { range, text: 'beyond', index: 50, length: 4 },
      { range, text: 'empty', index: 8, length: 0 },
    ]);
    expect(parseInline('Gen 1:1 x').map((node) => node.type)).toEqual(['reference', 'text']);
  });
});

describe('toPlainText', () => {
  test('strips syntax, keeps text, separates blocks with newlines', () => {
    const note = '# Title\n\n- **one**\n- two [04:32]\n\n1. first\n\nText ==hi== and *it*';
    expect(toPlainText(note)).toBe('Title\none\ntwo 04:32\nfirst\nText hi and it');
  });

  test('returns empty string for empty content', () => {
    expect(toPlainText('')).toBe('');
  });

  test('keeps references as text without running reference detection', () => {
    expect(toPlainText('Read **Romans 8:28**')).toBe('Read Romans 8:28');
    expect(mockedFind).not.toHaveBeenCalled();
  });
});

describe('extractTimestamps', () => {
  test('returns valid timestamps with their source offsets in order', () => {
    const note = '# Intro [00:10]\n- point [4:75]\n- point [1:02:07]';
    expect(extractTimestamps(note)).toEqual([
      { text: '00:10', positionMs: 10_000, index: 8 },
      { text: '1:02:07', positionMs: 3_727_000, index: note.indexOf('[1:02:07]') },
    ]);
  });

  test('returns an empty list when there are none', () => {
    expect(extractTimestamps('no times here')).toEqual([]);
  });
});

describe('robustness', () => {
  function randomString(alphabet: string, length: number, seed: { value: number }): string {
    let out = '';
    for (let i = 0; i < length; i++) {
      seed.value = (seed.value * 1_103_515_245 + 12_345) % 2_147_483_648;
      out += alphabet[seed.value % alphabet.length];
    }
    return out;
  }

  test('never throws on random input', () => {
    const seed = { value: 42 };
    const alphabet = '*_=[]:#-.1234567890 ab\n\r\t\\';
    for (let i = 0; i < 400; i++) {
      const input = randomString(alphabet, i % 120, seed);
      expect(() => parseNote(input)).not.toThrow();
      expect(typeof toPlainText(input)).toBe('string');
      expect(Array.isArray(extractTimestamps(input))).toBe(true);
    }
  });

  test('never loses or invents non-marker characters', () => {
    const seed = { value: 7 };
    const stripMarkers = (value: string) => value.replace(/[*_=]/g, '');
    for (let i = 0; i < 400; i++) {
      const input = randomString('*_= ab\n', 1 + (i % 60), seed);
      expect(stripMarkers(inlineToPlainText(parseInline(input)))).toBe(stripMarkers(input));
    }
  });

  test('parses a 5,000-word note quickly', () => {
    const paragraph = 'We read **Romans 8:28** at [12:30] and ==remembered== *grace* today. '.repeat(10);
    const note = Array.from({ length: 70 }, (_, i) => (i % 7 === 0 ? `## Point ${i}\n${paragraph}` : `- ${paragraph}`)).join('\n\n');
    expect(note.split(/\s+/).length).toBeGreaterThan(5_000);

    const started = Date.now();
    const blocks = parseNote(note);
    const elapsed = Date.now() - started;

    expect(blocks.length).toBeGreaterThan(70);
    expect(elapsed).toBeLessThan(1_000);
  });
});
