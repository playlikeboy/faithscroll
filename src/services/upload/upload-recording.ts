/**
 * Upload one recording part to private storage, choosing resumable (TUS) for anything larger than
 * a single 6 MB chunk, and delete cloud copies. Never called without an explicit user action.
 */
import { AiServiceError } from '@/services/ai/errors';
import { getAccessToken } from '@/services/ai/client';
import { getSupabase, getSupabaseConfig } from '@/services/supabase/client';

import { AUDIO_BUCKET, MAX_TRANSCRIBE_BYTES, RESUMABLE_THRESHOLD_BYTES } from './paths';
import { uploadResumable } from './resumable';
import { uploadStandard } from './standard';
import type { UploadContext, UploadFileInput } from './types';

export function uploadContext(): UploadContext {
  const config = getSupabaseConfig();
  if (!config) throw new AiServiceError('not_configured');
  return { supabaseUrl: config.url, anonKey: config.anonKey, getAccessToken };
}

export function shouldUseResumable(sizeBytes: number): boolean {
  return sizeBytes > RESUMABLE_THRESHOLD_BYTES;
}

export async function uploadRecordingFile(input: UploadFileInput, context: UploadContext = uploadContext()): Promise<void> {
  if (input.sizeBytes > MAX_TRANSCRIBE_BYTES) throw new AiServiceError('audio_too_large');
  if (shouldUseResumable(input.sizeBytes)) {
    await uploadResumable(input, context);
    return;
  }
  await uploadStandard(input, context);
}

/** Remove the user's cloud copies (RLS limits this to their own folder). */
export async function deleteCloudObjects(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) throw new AiServiceError('not_configured');
  await getAccessToken();
  let result: { error: unknown };
  try {
    result = await supabase.storage.from(AUDIO_BUCKET).remove([...paths]);
  } catch {
    throw new AiServiceError('offline');
  }
  if (result.error) throw new AiServiceError('server');
}
