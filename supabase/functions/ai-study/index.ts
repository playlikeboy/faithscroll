/**
 * POST /functions/v1/ai-study
 * Body: { reference, translation, passageText, mode: 'basic' | 'advanced', lexicalData: [] }
 * Starts a Deep Study job and responds with { data: { jobId, status } }. Advanced mode needs Plus.
 * Original-language content is removed server-side unless lexical data was supplied.
 */
import { parseStudyRequest } from '../_shared/ai-core.ts';
import { reserveAndCreateJob, runGenerationJob } from '../_shared/ai-jobs.ts';
import { buildStudyPrompt } from '../_shared/ai-prompts.ts';
import { adminClient, background, createProvider, enforceRateLimit, ok, readJson, requireUser, serveAi } from '../_shared/ai.ts';

const STUDY_MAX_OUTPUT_TOKENS = 16_000;
const STUDY_TIMEOUT_MS = 300_000;

function withoutOriginalLanguage(output: unknown): unknown {
  if (!output || typeof output !== 'object') return output;
  return { ...(output as Record<string, unknown>), original_language: null };
}

serveAi('ai-study', async (req) => {
  const client = adminClient();
  const userId = await requireUser(req, client);
  const input = parseStudyRequest(await readJson(req));
  const provider = createProvider();
  await enforceRateLimit(client, userId);

  const job = await reserveAndCreateJob(client, provider, {
    userId,
    type: 'study',
    sermonId: null,
    amount: 1,
    mode: input.mode,
    input: { reference: input.reference, translation: input.translation, mode: input.mode, lexicalEntries: input.lexicalData.length },
  });

  const hasLexicalData = input.lexicalData.length > 0;
  background(
    runGenerationJob(client, provider, job.id, {
      task: 'study',
      prompt: buildStudyPrompt(input),
      maxOutputTokens: STUDY_MAX_OUTPUT_TOKENS,
      timeoutMs: STUDY_TIMEOUT_MS,
      postProcess: hasLexicalData ? undefined : withoutOriginalLanguage,
    }),
  );
  return ok({ jobId: job.id, status: job.status });
});
