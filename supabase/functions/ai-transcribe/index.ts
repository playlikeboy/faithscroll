/**
 * POST /functions/v1/ai-transcribe
 * Body: { sermonId, parts: [{ recordingId, path, durationMs, mimeType }], language }
 * Audio must already be uploaded to sermon-audio/<uid>/<sermonId>/<recordingId>.m4a.
 * Responds immediately with { data: { jobId, status } }; poll ai-job-status for the result.
 */
import { parseTranscribeRequest, totalSeconds } from '../_shared/ai-core.ts';
import { reserveAndCreateJob, runTranscriptionJob } from '../_shared/ai-jobs.ts';
import { adminClient, background, createProvider, enforceRateLimit, ok, readJson, requireUser, serveAi } from '../_shared/ai.ts';

serveAi('ai-transcribe', async (req) => {
  const client = adminClient();
  const userId = await requireUser(req, client);
  const input = parseTranscribeRequest(await readJson(req), userId);
  const provider = createProvider();
  await enforceRateLimit(client, userId);

  const job = await reserveAndCreateJob(client, provider, {
    userId,
    type: 'transcribe',
    sermonId: input.sermonId,
    amount: totalSeconds(input.parts),
    input: { parts: input.parts, language: input.language },
  });

  background(runTranscriptionJob(client, provider, job.id));
  return ok({ jobId: job.id, status: job.status });
});
