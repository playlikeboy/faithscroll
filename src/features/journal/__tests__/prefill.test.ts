import { appendPrompt, hasMeaningfulContent, parseJournalPrefill, parsePassageParams, toDraftChanges } from '../prefill';

const JOHN_3_16 = 43003016;
const JOHN_3_18 = 43003018;

describe('parsePassageParams', () => {
  test('parses a valid range and defaults end to start', () => {
    expect(parsePassageParams(String(JOHN_3_16), String(JOHN_3_18))).toEqual({ startVerseId: JOHN_3_16, endVerseId: JOHN_3_18 });
    expect(parsePassageParams(String(JOHN_3_16), undefined)).toEqual({ startVerseId: JOHN_3_16, endVerseId: JOHN_3_16 });
  });

  test('orders reversed ranges', () => {
    expect(parsePassageParams(String(JOHN_3_18), String(JOHN_3_16))).toEqual({ startVerseId: JOHN_3_16, endVerseId: JOHN_3_18 });
  });

  test('rejects malformed or impossible verse ids', () => {
    expect(parsePassageParams(undefined, undefined)).toBeNull();
    expect(parsePassageParams('abc', undefined)).toBeNull();
    expect(parsePassageParams('99001001', undefined)).toBeNull();
    expect(parsePassageParams('43000016', undefined)).toBeNull();
    expect(parsePassageParams('43003000', undefined)).toBeNull();
    expect(parsePassageParams(String(JOHN_3_16), 'oops')).toEqual({ startVerseId: JOHN_3_16, endVerseId: JOHN_3_16 });
  });
});

describe('parseJournalPrefill', () => {
  test('reads every supported param', () => {
    expect(
      parseJournalPrefill({
        type: 'sermon_reflection',
        prompt: '  What stood out to me today?  ',
        start: String(JOHN_3_16),
        end: String(JOHN_3_18),
        sermonId: 'sermon-1',
        actionItemId: 'action-1',
      }),
    ).toEqual({
      entryType: 'sermon_reflection',
      prompt: 'What stood out to me today?',
      passage: { startVerseId: JOHN_3_16, endVerseId: JOHN_3_18 },
      links: [
        { type: 'sermon', id: 'sermon-1' },
        { type: 'action_item', id: 'action-1' },
      ],
    });
  });

  test('ignores invalid values and arrays', () => {
    expect(parseJournalPrefill({ type: 'diary', prompt: '   ', sermonId: 'has spaces', actionItemId: ['a', 'b'] })).toEqual({
      entryType: null,
      prompt: null,
      passage: null,
      links: [{ type: 'action_item', id: 'a' }],
    });
  });

  test('caps very long prompts', () => {
    expect(parseJournalPrefill({ prompt: 'x'.repeat(500) }).prompt).toHaveLength(200);
  });

  test('infers a sermon reflection when only a sermon is given', () => {
    expect(parseJournalPrefill({ sermonId: 's1' }).entryType).toBe('sermon_reflection');
    expect(parseJournalPrefill({ start: String(JOHN_3_16) }).entryType).toBe('bible_study');
  });
});

describe('drafts', () => {
  const empty = { title: '', content: '', entryType: 'personal' as const, entryDate: '2026-11-10', prompt: null };

  test('appendPrompt adds a heading and keeps existing text', () => {
    expect(appendPrompt('', 'What am I learning?')).toBe('## What am I learning?\n');
    expect(appendPrompt('Some thoughts\n\n', 'What am I learning?')).toBe('Some thoughts\n\n## What am I learning?\n');
  });

  test('prompt headings alone are not meaningful; real words are', () => {
    expect(hasMeaningfulContent(empty)).toBe(false);
    expect(hasMeaningfulContent({ ...empty, content: '## What am I learning?\n\n' })).toBe(false);
    expect(hasMeaningfulContent({ ...empty, content: '## Custom heading' })).toBe(true);
    expect(hasMeaningfulContent({ ...empty, title: '  Morning ' })).toBe(true);
    expect(hasMeaningfulContent({ ...empty, content: '## What am I learning?\nPatience' })).toBe(true);
  });

  test('toDraftChanges trims the prompt to null when blank', () => {
    expect(toDraftChanges({ ...empty, prompt: '  ' })).toEqual(expect.objectContaining({ prompt: null }));
  });
});
