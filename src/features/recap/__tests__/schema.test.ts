import {
  emptyRecap,
  isRecapEmpty,
  parseRecapOutput,
  parseStoredRecap,
  RECAP_SECTIONS,
  serializeRecap,
  type SermonRecap,
} from '../schema';

const modelOutput = {
  title: 'The Power of Forgiveness',
  summary: '  The sermon walked through Peter’s question about forgiveness.  ',
  main_points: [{ heading: 'Forgiveness is limitless', description: 'Seventy times seven.', timestamps: [65, 300.5] }],
  scripture_references: [{ reference: 'Matthew 18:21-22', timestamp: 120, context: 'Peter asks Jesus' }],
  important_moments: [{ description: 'The parable begins', timestamp: 410 }],
  discussion_questions: ['Who do you find hard to forgive?'],
  action_items: [{ title: 'Write down one name to pray for', description: null }],
  reflection_questions: ['Where have I received mercy this week?'],
};

describe('parseRecapOutput', () => {
  test('accepts a well-formed model object and trims text', () => {
    const result = parseRecapOutput(modelOutput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.summary).toBe('The sermon walked through Peter’s question about forgiveness.');
    expect(result.data.main_points[0].timestamps).toEqual([65, 300.5]);
    expect(result.data.action_items[0]).toEqual({ title: 'Write down one name to pray for', description: null });
  });

  test('accepts a JSON string', () => {
    const result = parseRecapOutput(JSON.stringify(modelOutput));
    expect(result.success).toBe(true);
  });

  test('rejects malformed JSON and wrong shapes with a reason', () => {
    expect(parseRecapOutput('{not json')).toEqual({ success: false, error: 'invalid_json' });
    const missing = parseRecapOutput({ ...modelOutput, summary: undefined });
    expect(missing.success).toBe(false);
    expect(parseRecapOutput(null).success).toBe(false);
  });

  test('drops blank list items and caps very long lists', () => {
    const result = parseRecapOutput({
      ...modelOutput,
      discussion_questions: ['  ', 'One?', ...Array.from({ length: 40 }, (_, i) => `Q${i}?`)],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.discussion_questions[0]).toBe('One?');
    expect(result.data.discussion_questions.length).toBeLessThanOrEqual(12);
  });

  test('drops items whose required text is empty after trimming', () => {
    const result = parseRecapOutput({
      ...modelOutput,
      main_points: [{ heading: ' ', description: ' ', timestamps: [] }, modelOutput.main_points[0]],
      action_items: [{ title: '', description: 'x' }],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.main_points).toHaveLength(1);
    expect(result.data.action_items).toHaveLength(0);
  });

  test('rejects non-finite timestamps', () => {
    const result = parseRecapOutput({ ...modelOutput, important_moments: [{ description: 'x', timestamp: 'soon' }] });
    expect(result.success).toBe(false);
  });
});

describe('stored recaps', () => {
  test('round-trips through serialize/parseStoredRecap including verse ids', () => {
    const parsed = parseRecapOutput(modelOutput);
    if (!parsed.success) throw new Error('fixture invalid');
    const withIds: SermonRecap = {
      ...parsed.data,
      scripture_references: [{ ...parsed.data.scripture_references[0], startVerseId: 40018021, endVerseId: 40018022 }],
    };
    expect(parseStoredRecap(serializeRecap(withIds))).toEqual(withIds);
  });

  test('returns null for empty or corrupt stored JSON', () => {
    expect(parseStoredRecap(null)).toBeNull();
    expect(parseStoredRecap('')).toBeNull();
    expect(parseStoredRecap('[1,2]')).toBeNull();
  });
});

describe('recap helpers', () => {
  test('lists the seven sections in PRD order', () => {
    expect(RECAP_SECTIONS.map((section) => section.key)).toEqual([
      'summary',
      'main_points',
      'scripture_references',
      'important_moments',
      'discussion_questions',
      'action_items',
      'reflection_questions',
    ]);
    expect(RECAP_SECTIONS.find((s) => s.key === 'action_items')?.title).toBe('Live It Out');
  });

  test('isRecapEmpty detects a recap with no content', () => {
    expect(isRecapEmpty(emptyRecap())).toBe(true);
    expect(isRecapEmpty({ ...emptyRecap(), summary: 'x' })).toBe(false);
  });
});
