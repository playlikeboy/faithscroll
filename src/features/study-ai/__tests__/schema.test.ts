import {
  DEEP_STUDY_SECTIONS,
  enforceGrounding,
  parseAskAnswer,
  parseDeepStudyOutput,
  visibleSections,
  type DeepStudy,
} from '../schema';
import { askAnswerFixture, deepStudyFixture } from '../testing/fixtures';

const section = (body: string) => ({ body, kind: 'text', sources: [] });

function parsedFixture(): DeepStudy {
  const parsed = parseDeepStudyOutput(deepStudyFixture());
  if (!parsed.success) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

describe('parseDeepStudyOutput', () => {
  test('accepts a complete advanced study', () => {
    expect(parseDeepStudyOutput(deepStudyFixture()).success).toBe(true);
  });

  test('accepts a basic study with advanced sections omitted (null)', () => {
    const result = parseDeepStudyOutput({
      ...deepStudyFixture(),
      historical_background: null,
      literary_context: null,
      original_language: null,
      theological_significance: null,
    });
    expect(result.success).toBe(true);
  });

  test('rejects an unknown section kind or source type', () => {
    expect(parseDeepStudyOutput({ ...deepStudyFixture(), overview: { ...section('x'), kind: 'prophecy' } }).success).toBe(false);
    const badSource = { ...section('x'), sources: [{ type: 'dream', reference: null, label: 'x' }] };
    expect(parseDeepStudyOutput({ ...deepStudyFixture(), overview: badSource }).success).toBe(false);
  });

  test('rejects malformed JSON', () => {
    expect(parseDeepStudyOutput('{')).toEqual({ success: false, error: 'invalid_json' });
  });
});

describe('enforceGrounding', () => {
  test('removes original-language content when no lexical data was supplied, without mutating', () => {
    const study = parsedFixture();
    expect(enforceGrounding(study, { hasLexicalData: false }).original_language).toBeNull();
    expect(study.original_language).not.toBeNull();
  });

  test('keeps original-language content only when it cites the supplied lexical data', () => {
    const study = parsedFixture();
    expect(enforceGrounding(study, { hasLexicalData: true }).original_language).not.toBeNull();

    const ungrounded: DeepStudy = {
      ...study,
      original_language: study.original_language && { ...study.original_language, sources: [] },
    };
    expect(enforceGrounding(ungrounded, { hasLexicalData: true }).original_language).toBeNull();
  });
});

describe('visibleSections', () => {
  test('lists present sections in editorial order', () => {
    const study: DeepStudy = { ...parsedFixture(), historical_background: null };
    const keys = visibleSections(study).map((s) => s.key);
    expect(keys[0]).toBe('overview');
    expect(keys).not.toContain('historical_background');
    expect(keys).toContain('reflection_questions');
    expect(DEEP_STUDY_SECTIONS).toHaveLength(10);
  });
});

describe('parseAskAnswer', () => {
  test('accepts an answer with citations', () => {
    expect(parseAskAnswer(askAnswerFixture()).success).toBe(true);
  });

  test('rejects an empty answer', () => {
    expect(parseAskAnswer({ ...askAnswerFixture(), answer: '  ' }).success).toBe(false);
  });
});
