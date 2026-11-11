import { useEffect, useMemo } from 'react';

import { useChapter, useCrossReferences, useVerses } from '@/features/bible/hooks/use-bible-text';
import { useRangeAnnotations } from '@/features/bible/hooks/use-range-annotations';
import type { VerseRange } from '@/features/bible/types';
import { track } from '@/services/monitoring/analytics';

import { surroundingContext } from './context';
import { reflectionQuestionsFor } from './reflection-questions';

export const STUDY_CROSS_REFERENCE_LIMIT = 10;

/** Everything the basic study screen shows: Scripture, context, references and the user's annotations. */
export function useBasicStudy(startVerseId: number, endVerseId: number, range: VerseRange) {
  const passage = useVerses(range);
  const startChapter = useChapter(range.start.bookId, range.start.chapter);
  const endChapter = useChapter(range.end.bookId, range.end.chapter);
  const crossReferences = useCrossReferences(startVerseId, STUDY_CROSS_REFERENCE_LIMIT);
  const annotations = useRangeAnnotations(startVerseId, endVerseId);

  useEffect(() => {
    track({ name: 'study_opened', mode: 'basic' });
  }, [startVerseId, endVerseId]);

  const context = useMemo(
    () => surroundingContext(startChapter.data ?? [], endChapter.data ?? [], startVerseId, endVerseId),
    [startChapter.data, endChapter.data, startVerseId, endVerseId],
  );
  const questions = useMemo(() => reflectionQuestionsFor(startVerseId), [startVerseId]);

  return { passage, context, crossReferences, annotations, questions };
}
