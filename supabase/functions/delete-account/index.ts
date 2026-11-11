/**
 * POST /functions/v1/delete-account — permanently deletes the caller's account.
 *
 * 1. Verify the caller's JWT (the platform also verifies it: verify_jwt = true).
 * 2. Delete the caller's objects in the private `sermon-audio` bucket (`<uid>/...`), if it exists.
 * 3. Delete the auth user with the service role. Every user table references auth.users with
 *    ON DELETE CASCADE, so profiles, preferences, synced rows, AI jobs and subscriptions go with it.
 *
 * Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the Edge Runtime.
 * Logs contain event names and counts only — no tokens, emails or user content.
 */
// eslint-disable-next-line import/no-unresolved -- Deno `npm:` specifier, resolved by the Edge Runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { errorResponse, handlePreflight, HttpError, jsonResponse, requireSecret, requireUser } from '../_shared/auth.ts';
import { deleteUserObjects, type BucketApi } from './storage-cleanup.ts';

const AUDIO_BUCKET = 'sermon-audio';

function serviceClient() {
  const read = (name: string) => Deno.env.get(name);
  const url = requireSecret(read, 'SUPABASE_URL');
  const serviceKey = requireSecret(read, 'SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

type ServiceClient = ReturnType<typeof serviceClient>;

async function deleteAudio(admin: ServiceClient, userId: string): Promise<number> {
  const { error: bucketError } = await admin.storage.getBucket(AUDIO_BUCKET);
  if (bucketError) return 0; // bucket not created in this project: nothing to delete
  const bucket = admin.storage.from(AUDIO_BUCKET) as unknown as BucketApi;
  return deleteUserObjects(bucket, userId);
}

Deno.serve(async (request: Request): Promise<Response> => {
  const preflight = handlePreflight(request);
  if (preflight) return preflight;
  if (request.method !== 'POST') {
    return errorResponse(new HttpError(405, 'method_not_allowed', 'Use POST.'));
  }

  try {
    const admin = serviceClient();
    const user = await requireUser(request, admin);

    let objectsRemoved = 0;
    try {
      objectsRemoved = await deleteAudio(admin, user.id);
    } catch (storageError) {
      console.error(JSON.stringify({ event: 'delete_account_storage_failed', reason: String(storageError) }));
      throw new HttpError(502, 'storage_cleanup_failed', 'We could not delete your cloud audio. Please try again.');
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(JSON.stringify({ event: 'delete_account_user_failed', status: deleteError.status ?? null }));
      throw new HttpError(500, 'delete_failed', 'We could not delete your account. Please try again.');
    }

    console.info(JSON.stringify({ event: 'account_deleted', objects_removed: objectsRemoved }));
    return jsonResponse({ ok: true, objectsRemoved });
  } catch (error) {
    if (!(error instanceof HttpError)) {
      console.error(JSON.stringify({ event: 'delete_account_unexpected', name: (error as Error)?.name ?? 'unknown' }));
    }
    return errorResponse(error);
  }
});
