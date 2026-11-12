import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { logger } from '@/lib/logger';

import { semanticSearchBible } from './semantic/semantic-search';

export const CONCEPT_RESULT_LIMIT = 20;
const MIN_LENGTH = 2;

/** Concept ("related topics") search over the bundled Bible for the Bible search screen. */
export function useConceptBibleSearch(query: string) {
  const trimmed = query.trim();
  const result = useQuery({
    queryKey: ['bible', 'concept-search', trimmed],
    queryFn: () => semanticSearchBible(trimmed, { limit: CONCEPT_RESULT_LIMIT }),
    enabled: trimmed.length >= MIN_LENGTH,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (result.error) logger.error('Concept Bible search failed', result.error);
  }, [result.error]);
  return result;
}
