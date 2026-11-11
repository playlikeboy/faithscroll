import { validateRecap } from '../validate';
import { emptyRecap, type SermonRecap } from '../schema';
import type { ReferenceChecker } from '@/services/ai/validation';

const checker: ReferenceChecker = async (text) => {
  if (text === 'Matt 18:21-22') {
    return {
      reference: 'Matthew 18:21–22',
      range: { start: { bookId: 40, chapter: 18, verse: 21 }, end: { bookId: 40, chapter: 18, verse: 22 } },
      startVerseId: 40018021,
      endVerseId: 40018022,
    };
  }
  return null;
};

const recap: SermonRecap = {
  ...emptyRecap(),
  summary: 'Summary',
  main_points: [{ heading: 'Point', description: 'Desc', timestamps: [30, 30, 5000, -2] }],
  scripture_references: [
    { reference: 'Matt 18:21-22', timestamp: 4000, context: null },
    { reference: 'Opinions 3:1', timestamp: 10, context: 'invented' },
  ],
  important_moments: [{ description: 'Moment', timestamp: 120 }],
};

describe('validateRecap', () => {
  test('drops unverifiable references, canonicalises the rest and clamps timestamps', async () => {
    const { recap: result, report } = await validateRecap(recap, { durationSec: 1800, checker });

    expect(result.scripture_references).toEqual([
      { reference: 'Matthew 18:21–22', timestamp: 1800, context: null, startVerseId: 40018021, endVerseId: 40018022 },
    ]);
    expect(result.main_points[0].timestamps).toEqual([0, 30, 1800]);
    expect(result.important_moments[0].timestamp).toBe(120);
    expect(report).toEqual({ droppedReferences: 1, adjustedTimestamps: 3 });
  });

  test('removes timestamps entirely when there is no recording', async () => {
    const { recap: result } = await validateRecap(recap, { durationSec: null, checker });
    expect(result.main_points[0].timestamps).toEqual([]);
    expect(result.important_moments[0].timestamp).toBeNull();
    expect(result.scripture_references[0].timestamp).toBeNull();
  });

  test('does not mutate its input', async () => {
    const snapshot = JSON.stringify(recap);
    await validateRecap(recap, { durationSec: 60, checker });
    expect(JSON.stringify(recap)).toBe(snapshot);
  });
});
