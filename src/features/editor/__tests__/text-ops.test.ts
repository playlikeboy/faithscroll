import {
  continueList,
  insertToken,
  normalizeState,
  timestampToken,
  toggleBlockFormat,
  toggleInlineFormat,
  type EditorState,
} from '../text-ops';

/** Build a state from text marked with « » (selection) or | (caret). */
function st(marked: string): EditorState {
  const caretAt = marked.indexOf('|');
  if (caretAt >= 0) {
    return { text: marked.replace('|', ''), selection: { start: caretAt, end: caretAt } };
  }
  const start = marked.indexOf('«');
  const end = marked.indexOf('»') - 1;
  return { text: marked.replace('«', '').replace('»', ''), selection: { start, end } };
}

/** Render a state back to the marked notation. */
function show({ text, selection: { start, end } }: EditorState): string {
  if (start === end) return `${text.slice(0, start)}|${text.slice(start)}`;
  return `${text.slice(0, start)}«${text.slice(start, end)}»${text.slice(end)}`;
}

describe('normalizeState', () => {
  test('orders and clamps the selection', () => {
    expect(normalizeState({ text: 'abc', selection: { start: 9, end: -2 } }).selection).toEqual({ start: 0, end: 3 });
    expect(normalizeState({ text: 'abc', selection: { start: Number.NaN, end: 1.7 } }).selection).toEqual({ start: 0, end: 1 });
  });
});

describe('toggleInlineFormat', () => {
  test.each([
    ['bold', 'a «word» b', 'a **«word»** b'],
    ['italic', 'a «word» b', 'a *«word»* b'],
    ['highlight', 'a «word» b', 'a ==«word»== b'],
  ] as const)('wraps the selection in %s', (format, input, expected) => {
    expect(show(toggleInlineFormat(st(input), format))).toBe(expected);
  });

  test.each([
    ['bold', 'a **«word»** b', 'a «word» b'],
    ['bold', 'a «**word**» b', 'a «word» b'],
    ['italic', 'a *«word»* b', 'a «word» b'],
    ['italic', 'a _«word»_ b', 'a «word» b'],
    ['highlight', '==«word»==', '«word»'],
    ['highlight', '«==word==»', '«word»'],
  ] as const)('unwraps an already %s selection', (format, input, expected) => {
    expect(show(toggleInlineFormat(st(input), format))).toBe(expected);
  });

  test('distinguishes bold from italic inside *** runs', () => {
    expect(show(toggleInlineFormat(st('**«word»**'), 'italic'))).toBe('***«word»***');
    expect(show(toggleInlineFormat(st('***«word»***'), 'italic'))).toBe('**«word»**');
    expect(show(toggleInlineFormat(st('***«word»***'), 'bold'))).toBe('*«word»*');
    expect(show(toggleInlineFormat(st('*«word»*'), 'bold'))).toBe('***«word»***');
  });

  test('trims surrounding whitespace from the selection', () => {
    expect(show(toggleInlineFormat(st('a« word »b'), 'bold'))).toBe('a **«word»** b');
  });

  test('formats each selected line separately and skips list prefixes', () => {
    expect(show(toggleInlineFormat(st('«- one\n\n- two»'), 'bold'))).toBe('- **«one**\n\n- **two»**');
    expect(show(toggleInlineFormat(st('«## Title\n1. item»'), 'highlight'))).toBe('## ==«Title==\n1. ==item»==');
  });

  test('unwraps all lines when every line is formatted, otherwise wraps the rest', () => {
    expect(show(toggleInlineFormat(st('«**a**\n**b**»'), 'bold'))).toBe('«a\nb»');
    expect(show(toggleInlineFormat(st('«**a**\nb»'), 'bold'))).toBe('«**a**\n**b»**');
  });

  test('inserts an empty pair at the caret and removes it again', () => {
    const inserted = toggleInlineFormat(st('say |now'), 'bold');
    expect(show(inserted)).toBe('say **|**now');
    expect(show(toggleInlineFormat(inserted, 'bold'))).toBe('say |now');
    expect(show(toggleInlineFormat(st('|'), 'highlight'))).toBe('==|==');
    expect(show(toggleInlineFormat(st('x|'), 'italic'))).toBe('x*|*');
  });

  test('a whitespace-only selection is left unchanged', () => {
    expect(show(toggleInlineFormat(st('a«  »b'), 'bold'))).toBe('a«  »b');
  });

  test('does not mutate the input state', () => {
    const input = st('a «b» c');
    const snapshot = JSON.stringify(input);
    toggleInlineFormat(input, 'bold');
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('toggleBlockFormat', () => {
  test('adds and removes a bullet on the caret line', () => {
    const bulleted = toggleBlockFormat(st('first\nsec|ond'), 'bullet');
    expect(show(bulleted)).toBe('first\n- sec|ond');
    expect(show(toggleBlockFormat(bulleted, 'bullet'))).toBe('first\nsec|ond');
  });

  test('starts a bullet on an empty line', () => {
    expect(show(toggleBlockFormat(st('|'), 'bullet'))).toBe('- |');
  });

  test('applies to every selected non-blank line', () => {
    expect(show(toggleBlockFormat(st('«a\n\nb\nc»'), 'bullet'))).toBe('- «a\n\n- b\n- c»');
  });

  test('does not include a line the selection only touches at column 0', () => {
    expect(show(toggleBlockFormat(st('«a\n»b'), 'bullet'))).toBe('- «a\n»b');
  });

  test('replaces other prefixes when converting', () => {
    expect(show(toggleBlockFormat(st('«## a\n1. b»'), 'bullet'))).toBe('- «a\n- b»');
  });

  test('numbers selected lines and removes numbering', () => {
    const numbered = toggleBlockFormat(st('«a\nb\nc»'), 'numbered');
    expect(show(numbered)).toBe('1. «a\n2. b\n3. c»');
    expect(show(toggleBlockFormat(numbered, 'numbered'))).toBe('«a\nb\nc»');
  });

  test('renumbers a list after removing an item from it', () => {
    expect(show(toggleBlockFormat(st('1. a\n2. |b\n3. c\n4. d'), 'numbered'))).toBe('1. a\n|b\n1. c\n2. d');
  });

  test('extending a list continues its numbering', () => {
    expect(show(toggleBlockFormat(st('4. a\n5. b\n|c'), 'numbered'))).toBe('4. a\n5. b\n6. |c');
  });

  test('renumbers following items when the run grows past 9', () => {
    const text = Array.from({ length: 9 }, (_, i) => `${i + 1}. item`).join('\n');
    const result = toggleBlockFormat(st(`new|\n${text}`), 'numbered');
    expect(result.text.split('\n')[0]).toBe('1. new');
    expect(result.text.split('\n')[9]).toBe('10. item');
  });

  test('cycles heading levels', () => {
    const h1 = toggleBlockFormat(st('Ti|tle'), 'heading');
    expect(show(h1)).toBe('# Ti|tle');
    const h2 = toggleBlockFormat(h1, 'heading');
    expect(show(h2)).toBe('## Ti|tle');
    const h3 = toggleBlockFormat(h2, 'heading');
    expect(show(h3)).toBe('### Ti|tle');
    expect(show(toggleBlockFormat(h3, 'heading'))).toBe('Ti|tle');
  });

  test('toggles a specific heading level', () => {
    const h2 = toggleBlockFormat(st('|Title'), 'heading', { headingLevel: 2 });
    expect(show(h2)).toBe('## |Title');
    expect(show(toggleBlockFormat(h2, 'heading', { headingLevel: 2 }))).toBe('|Title');
    expect(show(toggleBlockFormat(st('# |Title'), 'heading', { headingLevel: 2 }))).toBe('## |Title');
  });

  test('keeps a caret inside a removed prefix at the line start', () => {
    expect(show(toggleBlockFormat(st('-| item'), 'bullet'))).toBe('|item');
  });
});

describe('continueList', () => {
  test('continues a bullet list with the same marker and indentation', () => {
    expect(show(continueList('* one', '* one\n') as EditorState)).toBe('* one\n* |');
    expect(show(continueList('  - one', '  - one\n') as EditorState)).toBe('  - one\n  - |');
  });

  test('continues a numbered list and renumbers following items', () => {
    const prev = '1. one\n2. two';
    const next = '1. one\n\n2. two';
    expect(show(continueList(prev, next) as EditorState)).toBe('1. one\n2. |\n3. two');
  });

  test('uses the caret to disambiguate Return next to a blank line', () => {
    expect(continueList('1. one\n2. two', '1. one\n\n2. two', 7)).toBeNull();
    expect(show(continueList('- a\n\n', '- a\n\n\n', 3) as EditorState)).toBe('- a\n- |\n\n');
  });

  test('keeps the list start number when continuing', () => {
    expect(show(continueList('3. three', '3. three\n') as EditorState)).toBe('3. three\n4. |');
  });

  test('splits an item when Return is pressed mid-item', () => {
    expect(show(continueList('- abcd', '- ab\ncd') as EditorState)).toBe('- ab\n- |cd');
  });

  test('ends the list on an empty item', () => {
    expect(show(continueList('- one\n- ', '- one\n- \n') as EditorState)).toBe('- one\n|');
    expect(show(continueList('1. ', '1. \n') as EditorState)).toBe('|');
  });

  test('returns null for anything that is not Return on a list item', () => {
    expect(continueList('plain', 'plain\n')).toBeNull();
    expect(continueList('# Heading', '# Heading\n')).toBeNull();
    expect(continueList('- a', '- ab')).toBeNull();
    expect(continueList('- a', '- a\n\n')).toBeNull();
    expect(continueList('- a', '-\n a')).toBeNull();
  });
});

describe('insertToken', () => {
  test('adds spaces only where the token would touch a word', () => {
    expect(show(insertToken(st('word|'), '[04:32]'))).toBe('word [04:32] |');
    expect(show(insertToken(st('word |next'), '[04:32]'))).toBe('word [04:32] |next');
    expect(show(insertToken(st('|'), 'Romans 8:28'))).toBe('Romans 8:28 |');
    expect(show(insertToken(st('see (|)'), 'John 3:16'))).toBe('see (John 3:16|)');
    expect(show(insertToken(st('end|.'), 'John 3:16'))).toBe('end John 3:16|.');
    expect(show(insertToken(st('a|\nb'), '[00:01]'))).toBe('a [00:01]|\nb');
  });

  test('replaces the selection', () => {
    expect(show(insertToken(st('read «this» now'), 'Romans 8:28'))).toBe('read Romans 8:28| now');
  });

  test('ignores empty tokens', () => {
    expect(show(insertToken(st('a|'), '  '))).toBe('a|');
  });
});

describe('timestampToken', () => {
  test('formats positions as bracketed durations', () => {
    expect(timestampToken(272_000)).toBe('[04:32]');
    expect(timestampToken(3_727_000)).toBe('[1:02:07]');
    expect(timestampToken(Number.NaN)).toBe('[00:00]');
  });
});
