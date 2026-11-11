import { useQuery } from '@tanstack/react-query';

import { loadPassage, type LoadedPassage } from './passage';

export function usePassage(start: number, end: number) {
  return useQuery<LoadedPassage>({
    queryKey: ['study-passage', start, end],
    queryFn: () => loadPassage(start, end),
    staleTime: Infinity,
  });
}
