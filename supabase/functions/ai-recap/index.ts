/**
 * POST /functions/v1/ai-recap
 * Body: { sermonId, source: 'transcript' | 'notes', content, title, speaker, mainPassage, durationSec }
 * Starts a structured recap job (7 sections) and responds with { data: { jobId, status } }.
 * The transcript/notes are only held in memory for this job; they are not stored server-side.
 */
import { parseRecapRequest } from '../_shared/ai-core.ts';
import { reserveAndCreateJob, runGenerationJob } from '../_shared/ai-jobs.ts';
import { buildRecapPrompt } from '../_shared/ai-prompts.ts';
import { adminClient, background, createProvider, enforceRateLimit, ok, readJson, requireUser, serveAi } from '../_shared/ai.ts';

const RECAP_MAX_OUTPUT_TOKENS = 16_000;
const RECAP_TIMEOUT_MS = 300_000;

serveAi('ai-recap', async (req) => {
  const client = adminClient();
  const userId = await requireUser(req, client);
  const input = parseRecapRequest(await readJson(req));
  const provider = createProvider();
  await enforceRateLimit(client, userId);

  const job = await reserveAndCreateJob(client, provider, {
    userId,
    type: 'recap',
    sermonId: input.sermonId,
    amount: 1,
    input: { source: input.source, chars: input.content.length, durationSec: input.durationSec },
  });

  background(
    runGenerationJob(client, provider, job.id, {
      task: 'recap',
      prompt: buildRecapPrompt(input),
      maxOutputTokens: RECAP_MAX_OUTPUT_TOKENS,
      timeoutMs: RECAP_TIMEOUT_MS,
    }),
  );
  return ok({ jobId: job.id, status: job.status });
});
