import { parseAskAnswer, parseDeepStudyOutput, type AskAnswer, type DeepStudy } from '../schema';
import { askAnswerFixture, deepStudyFixture } from '../testing/fixtures';
import { validateAskAnswer, validateDeepStudy } from '../validate';
import type { ReferenceChecker } from '@/services/ai/validation';

const known: Record<string, string> = { 'John 3:16': 'John 3:16', 'Romans 5:8': 'Romans 5:8', 'John 3:3': 'John 3:3' };
const checker: ReferenceChecker = async (text) =>
  known[text]
    ? {
        reference: known[text],
        range: { start: { bookId: 43, chapter: 3, verse: 16 }, end: { bookId: 43, chapter: 3, verse: 16 } },
        startVerseId: 43003016,
        endVerseId: 43003016,
      }
    : null;

function study(): DeepStudy {
  const parsed = parseDeepStudyOutput(deepStudyFixture());
  if (!parsed.success) throw new Error(parsed.error);
  return parsed.data;
}

describe('validateDeepStudy', () => {
  test('keeps verified references and removes fabricated ones', async () => {
    const input: DeepStudy = {
      ...study(),
      related_scripture: {
        ...study().related_scripture,
        items: [...study().related_scripture.items, { reference: 'Hezekiah 1:1', connection: 'x' }],
      },
      overview: {
        ...study().overview,
        sources: [...study().overview.sources, { type: 'scripture', reference: '3 Peter 1:1', label: 'x' }],
      },
    };

    const { study: result, report } = await validateDeepStudy(input, { hasLexicalData: false, checker });

    expect(result.related_scripture.items.map((i) => i.reference)).toEqual(['Romans 5:8']);
    expect(result.overview.sources.map((s) => s.reference)).toEqual(['John 3:16']);
    expect(result.original_language).toBeNull();
    expect(report.droppedReferences).toBe(2);
  });

  test('keeps sources that carry no reference', async () => {
    const input: DeepStudy = {
      ...study(),
      historical_background: {
        body: 'x',
        kind: 'text',
        sources: [{ type: 'historical_scholarship', reference: null, label: 'Second Temple Judaism' }],
      },
    };
    const { study: result } = await validateDeepStudy(input, { hasLexicalData: false, checker });
    expect(result.historical_background?.sources).toHaveLength(1);
  });
});

describe('validateAskAnswer', () => {
  test('drops unverifiable citations', async () => {
    const parsed = parseAskAnswer({
      ...askAnswerFixture(),
      citations: [
        { reference: 'John 3:3', note: null },
        { reference: 'Gospel of Thomas 1', note: null },
      ],
    });
    if (!parsed.success) throw new Error(parsed.error);
    const { answer, report } = await validateAskAnswer(parsed.data as AskAnswer, checker);
    expect(answer.citations).toEqual([{ reference: 'John 3:3', note: null }]);
    expect(report.droppedReferences).toBe(1);
  });
});
