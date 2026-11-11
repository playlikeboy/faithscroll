/** Apply a finished recap job: validate on device, then store. */
import type { AppDatabase } from '@/db/types';
import { generationResultSchema, type AiJob } from '@/services/ai/contracts';
import type { ReferenceChecker } from '@/services/ai/validation';

import { markRecapFailed, saveRecapResult } from './repository';
import { parseRecapOutput } from './schema';
import { validateRecap, type RecapValidationReport } from './validate';

export type RecapApplyOutcome = { status: 'completed'; report: RecapValidationReport } | { status: 'failed'; errorCode: string };

export async function applyRecapJob(params: {
  db: AppDatabase;
  recapId: string;
  job: AiJob;
  /** Total recording length, or null when there is no recording. */
  durationSec: number | null;
  checker?: ReferenceChecker;
}): Promise<RecapApplyOutcome> {
  const { db, recapId, job } = params;
  if (job.status === 'failed') {
    const errorCode = job.errorCode ?? 'server';
    markRecapFailed(db, recapId, errorCode);
    return { status: 'failed', errorCode };
  }
  const envelope = generationResultSchema.safeParse(job.result);
  const parsed = envelope.success ? parseRecapOutput(envelope.data.output) : null;
  if (!parsed?.success) {
    markRecapFailed(db, recapId, 'invalid_output');
    return { status: 'failed', errorCode: 'invalid_output' };
  }
  const { recap, report } = await validateRecap(parsed.data, { durationSec: params.durationSec, checker: params.checker });
  saveRecapResult(db, recapId, recap, { provider: job.provider, model: job.model });
  return { status: 'completed', report };
}
