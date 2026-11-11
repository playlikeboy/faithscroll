import { loadPassage, parsePassageParams, passageText, toPassageContext } from '../passage';
import { askQuestion, historyFor, type ConversationEntry } from '../use-ask';
import { readStudyResult } from '../use-deep-study';
import { askAnswerFixture, deepStudyFixture } from '../testing/fixtures';
import { askAboutPassage } from '@/services/ai/api';
import type { AiJob } from '@/services/ai/contracts';
import type { Verse } from '@/features/bible/types';

jest.mock('@/services/ai/api', () => ({ askAboutPassage: jest.fn(), startStudy: jest.fn() }));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/repository', () => ({
  DEFAULT_TRANSLATION: { abbreviation: 'WEB' },
  getVerses: jest.fn(async (range: { start: { bookId: number; chapter: number; verse: number }; end: { chapter: number; verse: number } }) => {
    if (range.start.chapter !== range.end.chapter) return [];
    const verses = [];
    for (let v = range.start.verse; v <= range.end.verse; v += 1) {
      verses.push({ id: range.start.bookId * 1_000_000 + range.start.chapter * 1_000 + v, bookId: range.start.bookId, chapter: range.start.chapter, verse: v, text: `Verse ${v} text.` });
    }
    return verses;
  }),
}));

const verse = (chapter: number, n: number, text: string): Verse => ({
  id: 43_000_000 + chapter * 1_000 + n,
  bookId: 43,
  chapter,
  verse: n,
  text,
  heading: null,
  paragraphStart: false,
  poetry: false,
});

describe('parsePassageParams', () => {
  test('accepts a verse id range and defaults end to start', () => {
    expect(parsePassageParams({ start: '43003016', end: '43003017' })).toEqual({ start: 43003016, end: 43003017 });
    expect(parsePassageParams({ start: '43003016' })).toEqual({ start: 43003016, end: 43003016 });
    expect(parsePassageParams({ start: ['43003016'], end: [''] })).toEqual({ start: 43003016, end: 43003016 });
  });

  test('rejects malformed, reversed and cross-book ranges', () => {
    expect(parsePassageParams({ start: 'abc' })).toBeNull();
    expect(parsePassageParams({ start: '43003017', end: '43003016' })).toBeNull();
    expect(parsePassageParams({ start: '43003016', end: '44001001' })).toBeNull();
    expect(parsePassageParams({ start: '43000000' })).toBeNull();
    expect(parsePassageParams({})).toBeNull();
  });
});

describe('passage text', () => {
  test('numbers verses, adding chapters when the passage spans them', () => {
    expect(passageText([verse(3, 16, 'For God so loved'), verse(3, 17, ' For God did not send ')])).toBe('16 For God so loved\n17 For God did not send');
    expect(passageText([verse(3, 36, 'a'), verse(4, 1, 'b')])).toBe('3:36 a\n4:1 b');
  });

  test('loadPassage reads local verses and formats the reference', async () => {
    const passage = await loadPassage(43003016, 43003017);
    expect(passage.reference).toMatch(/John 3:16/);
    expect(passage.translation).toBe('WEB');
    expect(toPassageContext(passage)).toEqual({ reference: passage.reference, translation: 'WEB', passageText: '16 Verse 16 text.\n17 Verse 17 text.' });
  });
});

describe('askQuestion', () => {
  test('sends the passage, recent history and question; verifies citations', async () => {
    const passage = await loadPassage(43003003, 43003003);
    jest.mocked(askAboutPassage).mockResolvedValue({
      answer: { ...askAnswerFixture(), citations: [{ reference: 'John 3:3', note: null }, { reference: 'Gospel of Thomas 1:1', note: null }] },
      provider: 'openai',
      model: 'm',
    });
    const entries: ConversationEntry[] = [{ id: '1', role: 'user', text: 'Who is speaking?' }];

    const result = await askQuestion(passage, 'What does born again mean?', entries);

    expect(askAboutPassage).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'What does born again mean?', history: [{ role: 'user', content: 'Who is speaking?' }], translation: 'WEB' }),
    );
    expect(result.answer.citations.map((c) => c.reference)).toEqual([expect.stringMatching(/John 3:3/)]);
    expect(result.droppedReferences).toBe(1);
  });

  test('rejects an unusable answer', async () => {
    const passage = await loadPassage(43003003, 43003003);
    jest.mocked(askAboutPassage).mockResolvedValue({ answer: { nope: true }, provider: null, model: null });
    await expect(askQuestion(passage, 'Q?', [])).rejects.toMatchObject({ code: 'invalid_output' });
  });

  test('history keeps the last six turns as plain text', () => {
    const answer = { ...askAnswerFixture(), kind: 'text' as const, citations: [] };
    const entries: ConversationEntry[] = Array.from({ length: 8 }, (_, i) =>
      i % 2 === 0 ? { id: `${i}`, role: 'user' as const, text: `q${i}` } : { id: `${i}`, role: 'assistant' as const, answer: { ...answer, answer: `a${i}` }, droppedReferences: 0 },
    );
    expect(historyFor(entries)).toEqual([
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'a3' },
      { role: 'user', content: 'q4' },
      { role: 'assistant', content: 'a5' },
      { role: 'user', content: 'q6' },
      { role: 'assistant', content: 'a7' },
    ]);
  });
});

describe('readStudyResult', () => {
  const job = (result: unknown): AiJob => ({
    id: 'j',
    type: 'study',
    status: 'completed',
    result,
    errorCode: null,
    progress: null,
    provider: 'openai',
    model: 'm',
    updatedAt: '',
  });

  test('validates the study and removes ungrounded original-language notes', async () => {
    const { study, report } = await readStudyResult(job({ output: deepStudyFixture() }));
    expect(study.original_language).toBeNull();
    expect(study.related_scripture.items.map((i) => i.reference)).toEqual([expect.stringMatching(/Romans 5:8/)]);
    expect(report.droppedReferences).toBe(0);
  });

  test('throws invalid_output for malformed results', async () => {
    await expect(readStudyResult(job({ output: { passage: 1 } }))).rejects.toMatchObject({ code: 'invalid_output' });
    await expect(readStudyResult(job(null))).rejects.toMatchObject({ code: 'invalid_output' });
  });
});
