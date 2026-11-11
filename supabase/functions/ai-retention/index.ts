/**
 * POST /functions/v1/ai-retention   (scheduled by pg_cron — see docs/AI.md)
 * Header: x-retention-secret: <AI_RETENTION_SECRET>
 *
 * Deletes finished AI jobs older than AI_RESULT_RETENTION_DAYS and sermon audio older than
 * AI_AUDIO_RETENTION_DAYS. Audio is removed through the Storage API so the files are deleted,
 * not just their metadata rows. Deploy with --no-verify-jwt; the shared secret protects it.
 */
import { AiError } from '../_shared/ai-core.ts';
import { AUDIO_BUCKET } from '../_shared/ai-jobs.ts';
import { adminClient, audioRetentionDays, env, log, ok, retentionDays, serveAi } from '../_shared/ai.ts';

const REMOVE_BATCH = 100;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serveAi('ai-retention', async (req) => {
  const secret = env('AI_RETENTION_SECRET');
  const provided = req.headers.get('x-retention-secret') ?? '';
  if (!secret) throw new AiError('not_configured');
  if (!safeEqual(provided, secret)) throw new AiError('signed_out');

  const client = adminClient();
  const purged = await client.rpc('ai_purge_expired_jobs', { p_days: retentionDays() });
  if (purged.error) throw new AiError('server');

  const expired = await client.rpc('ai_expired_audio', { p_days: audioRetentionDays(), p_limit: 500 });
  if (expired.error) throw new AiError('server');
  const names = ((expired.data ?? []) as { name: string }[]).map((row) => row.name);

  let audioDeleted = 0;
  for (let i = 0; i < names.length; i += REMOVE_BATCH) {
    const batch = names.slice(i, i + REMOVE_BATCH);
    const { data, error } = await client.storage.from(AUDIO_BUCKET).remove(batch);
    if (error) throw new AiError('server');
    audioDeleted += data?.length ?? 0;
  }

  const jobsDeleted = typeof purged.data === 'number' ? purged.data : 0;
  log('ai_retention_run', { jobsDeleted, audioDeleted });
  return ok({ jobsDeleted, audioDeleted });
});
