import { useQuery } from '@tanstack/react-query';

import { getDictionaryEntry, getTopic } from './repository';

/** A topic page's data from the bundled database (never changes, so cached forever). */
export function useTopic(topicId: number) {
  return useQuery({
    queryKey: ['bible', 'topic', topicId],
    queryFn: () => getTopic(topicId),
    enabled: Number.isInteger(topicId) && topicId > 0,
    staleTime: Infinity,
  });
}

export function useDictionaryEntry(entryId: number) {
  return useQuery({
    queryKey: ['bible', 'dictionary', entryId],
    queryFn: () => getDictionaryEntry(entryId),
    enabled: Number.isInteger(entryId) && entryId > 0,
    staleTime: Infinity,
  });
}
