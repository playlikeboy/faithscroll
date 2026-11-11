/**
 * POST /functions/v1/ai-job-status
 * Body: { jobId }
 * Returns { data: { id, type, status, result, errorCode, progress, provider, model, updatedAt } }
 * for the caller's own job. Also recovers jobs whose worker stopped (Edge Function wall-clock
 * limit): transcription resumes with the missing parts, other jobs are failed with `timeout`.
 */
import { parseJobStatusRequest, toJobDto } from '../_shared/ai-core.ts';
import { failJob, getUserJob, recoveryAction, runTranscriptionJob } from '../_shared/ai-jobs.ts';
import { adminClient, background, createProvider, ok, readJson, requireUser, serveAi } from '../_shared/ai.ts';

serveAi('ai-job-status', async (req) => {
  const client = adminClient();
  const userId = await requireUser(req, client);
  const { jobId } = parseJobStatusRequest(await readJson(req));

  let job = await getUserJob(client, userId, jobId);
  const action = recoveryAction(job, new Date());
  if (action === 'resume') {
    background(runTranscriptionJob(client, createProvider(), job.id));
  } else if (action === 'fail') {
    await failJob(client, job, 'timeout');
    job = await getUserJob(client, userId, jobId);
  }

  return ok(toJobDto(job));
});
