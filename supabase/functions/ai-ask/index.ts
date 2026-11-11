/**
 * POST /functions/v1/ai-ask
 * Body: { reference, translation, passageText, question, history: [{ role, content }] }
 * Answers synchronously: { data: { answer, provider, model } }.
 * The question and answer are not stored (the job row only records usage).
 */
import { parseAskRequest } from '../_shared/ai-core.ts';
import { reserveAndCreateJob, runInlineJob } from '../_shared/ai-jobs.ts';
import { buildAskPrompt } from '../_shared/ai-prompts.ts';
import { adminClient, createProvider, enforceRateLimit, ok, readJson, requireUser, serveAi } from '../_shared/ai.ts';

const ASK_MAX_OUTPUT_TOKENS = 4_000;
/** Below the 150 s request idle timeout. */
const ASK_TIMEOUT_MS = 90_000;

serveAi('ai-ask', async (req) => {
  const client = adminClient();
  const userId = await requireUser(req, client);
  const input = parseAskRequest(await readJson(req));
  const provider = createProvider();
  await enforceRateLimit(client, userId);

  const job = await reserveAndCreateJob(client, provider, {
    userId,
    type: 'ask',
    sermonId: null,
    amount: 1,
    input: { reference: input.reference, translation: input.translation, turns: input.history.length },
  });

  const { output, model } = await runInlineJob(client, provider, job.id, {
    task: 'ask',
    prompt: buildAskPrompt(input),
    maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    timeoutMs: ASK_TIMEOUT_MS,
  });
  return ok({ answer: output, provider: provider.id, model });
});
