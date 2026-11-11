/**
 * Deep Study generation: start a job for the passage + mode, poll it, then validate the result on
 * device (references, grounding). Results live in memory for the session (not stored).
 */
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { create } from 'zustand';

import { startStudy } from '@/services/ai/api';
import { generationResultSchema, type AiJob } from '@/services/ai/contracts';
import { AiServiceError, toAiServiceError, type AiClientErrorCode } from '@/services/ai/errors';
import { useAiJob } from '@/services/ai/use-ai-job';

import type { LoadedPassage } from './passage';
import { toPassageContext } from './passage';
import { parseDeepStudyOutput, type DeepStudy, type StudyMode } from './schema';
import { validateDeepStudy, type StudyValidationReport } from './validate';

/** Job ids per passage + mode for this app session, so returning to the screen shows the result. */
const useStudyJobs = create<{ jobs: Record<string, string>; set: (key: string, jobId: string) => void }>()((set) => ({
  jobs: {},
  set: (key, jobId) => set((state) => ({ jobs: { ...state.jobs, [key]: jobId } })),
}));

export function studyKey(start: number, end: number, mode: StudyMode): string {
  return `${start}-${end}-${mode}`;
}

export async function readStudyResult(job: AiJob): Promise<{ study: DeepStudy; report: StudyValidationReport }> {
  const envelope = generationResultSchema.safeParse(job.result);
  const parsed = envelope.success ? parseDeepStudyOutput(envelope.data.output) : null;
  if (!parsed?.success) throw new AiServiceError('invalid_output');
  // No verified lexical data ships with the app yet, so original-language notes are always omitted.
  return validateDeepStudy(parsed.data, { hasLexicalData: false });
}

export function useDeepStudy(passage: LoadedPassage | undefined, start: number, end: number) {
  const [mode, setMode] = useState<StudyMode>('basic');
  const [startError, setStartError] = useState<AiClientErrorCode | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const key = studyKey(start, end, mode);
  const jobId = useStudyJobs((state) => state.jobs[key] ?? null);
  const job = useAiJob(jobId);

  const result = useQuery({
    queryKey: ['deep-study-result', jobId],
    queryFn: () => readStudyResult(job.data as AiJob),
    enabled: job.data?.status === 'completed',
    staleTime: Infinity,
    retry: false,
  });

  const generate = useCallback(async (): Promise<AiClientErrorCode | null> => {
    if (!passage) return 'invalid_request';
    setStartError(null);
    setIsStarting(true);
    try {
      const response = await startStudy({ ...toPassageContext(passage), mode, lexicalData: [] });
      useStudyJobs.getState().set(key, response.jobId);
      return null;
    } catch (error) {
      const code = toAiServiceError(error).code;
      setStartError(code);
      return code;
    } finally {
      setIsStarting(false);
    }
  }, [passage, mode, key]);

  const jobFailed = job.data?.status === 'failed' ? (job.data.errorCode ?? 'server') : null;
  const resultError = result.error ? toAiServiceError(result.error).code : null;

  return {
    mode,
    setMode,
    generate,
    hasStarted: jobId !== null,
    isWorking: isStarting || (jobId !== null && !job.error && job.data?.status !== 'completed' && job.data?.status !== 'failed') || result.isLoading,
    errorCode: startError ?? jobFailed ?? (job.error ? job.error.code : null) ?? resultError,
    study: result.data?.study ?? null,
    droppedReferences: result.data?.report.droppedReferences ?? 0,
  };
}
