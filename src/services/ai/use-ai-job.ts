/**
 * Polls an AI job with TanStack Query until it completes or fails. Polling backs off gently and
 * keeps going through transient network errors (the job keeps running server-side).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getAiJob } from './api';
import { isTerminalStatus, type AiJob } from './contracts';
import { AiServiceError, isRetryable, toAiServiceError } from './errors';

const FAST_POLL_MS = 3_000;
const MEDIUM_POLL_MS = 6_000;
const SLOW_POLL_MS = 10_000;
const ERROR_POLL_MS = 15_000;

export function aiJobQueryKey(jobId: string | null): readonly ['ai-job', string | null] {
  return ['ai-job', jobId] as const;
}

/** Interval after `updates` successful polls: 3 s for ~30 s, 6 s for ~3 min, then 10 s. */
export function pollInterval(updates: number): number {
  if (updates < 10) return FAST_POLL_MS;
  if (updates < 40) return MEDIUM_POLL_MS;
  return SLOW_POLL_MS;
}

/** Next refetch delay, or false to stop polling. */
export function nextPoll(job: AiJob | undefined, error: unknown, updates: number): number | false {
  if (job && isTerminalStatus(job.status)) return false;
  if (error) return isRetryable(toAiServiceError(error).code) ? ERROR_POLL_MS : false;
  return pollInterval(updates);
}

export function useAiJob(jobId: string | null, { enabled = true }: { enabled?: boolean } = {}): UseQueryResult<AiJob, AiServiceError> {
  return useQuery<AiJob, AiServiceError>({
    queryKey: aiJobQueryKey(jobId),
    queryFn: async () => {
      try {
        return await getAiJob(jobId as string);
      } catch (error) {
        throw toAiServiceError(error);
      }
    },
    enabled: enabled && jobId !== null,
    staleTime: 0,
    retry: (failures, error) => failures < 2 && isRetryable(error.code),
    refetchInterval: (query) => nextPoll(query.state.data, query.state.error, query.state.dataUpdateCount),
    refetchIntervalInBackground: false,
  });
}
