/** Typed AI API used by the transcription, recap and study features. */
import { invokeAiFunction } from './client';
import {
  aiJobSchema,
  askResponseSchema,
  startJobResponseSchema,
  type AiJob,
  type AskRequest,
  type RecapRequest,
  type StartJobResponse,
  type StudyRequest,
  type TranscribeRequest,
} from './contracts';

/** Long enough for a slow mobile network, still below the 150 s gateway timeout. */
const ASK_TIMEOUT_MS = 110_000;

export function startTranscription(request: TranscribeRequest): Promise<StartJobResponse> {
  return invokeAiFunction('ai-transcribe', request, startJobResponseSchema);
}

export function startRecap(request: RecapRequest): Promise<StartJobResponse> {
  return invokeAiFunction('ai-recap', request, startJobResponseSchema);
}

export function startStudy(request: StudyRequest): Promise<StartJobResponse> {
  return invokeAiFunction('ai-study', request, startJobResponseSchema);
}

export function askAboutPassage(request: AskRequest): Promise<{ answer: unknown; provider: string | null; model: string | null }> {
  return invokeAiFunction('ai-ask', request, askResponseSchema, { timeoutMs: ASK_TIMEOUT_MS });
}

export function getAiJob(jobId: string): Promise<AiJob> {
  return invokeAiFunction('ai-job-status', { jobId }, aiJobSchema);
}
