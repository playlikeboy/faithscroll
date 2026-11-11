/** Storage layout and endpoints for sermon audio uploads. */

export const AUDIO_BUCKET = 'sermon-audio';
/** Transcription provider per-file limit (25 MB). Larger parts are rejected before upload. */
export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;
/** Supabase requires exactly 6 MB TUS chunks; files up to one chunk use a single request. */
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
export const RESUMABLE_THRESHOLD_BYTES = TUS_CHUNK_SIZE;

const SAFE_SEGMENT = /^[A-Za-z0-9-]+$/;

function extensionOf(fileName: string | null | undefined): string {
  const match = /\.([A-Za-z0-9]{2,5})$/.exec(fileName ?? '');
  return match ? match[1].toLowerCase() : 'm4a';
}

/**
 * `sermon-audio/<userId>/<sermonId>/<recordingId>.<ext>` — the first folder must be the user's id
 * (enforced by storage RLS and re-checked by the ai-transcribe function).
 */
export function recordingObjectPath(userId: string, sermonId: string, recordingId: string, localFileName?: string | null): string {
  [userId, sermonId, recordingId].forEach((segment) => {
    if (!SAFE_SEGMENT.test(segment)) throw new Error('Invalid storage path segment');
  });
  return `${userId}/${sermonId}/${recordingId}.${extensionOf(localFileName)}`;
}

/**
 * TUS endpoint. Hosted projects use the direct storage hostname
 * (`https://<ref>.storage.supabase.co`) as Supabase recommends; local stacks use the API URL.
 */
export function resumableEndpoint(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/+$/, '');
  const hosted = /^https:\/\/([a-z0-9]+)\.supabase\.co$/i.exec(base);
  const origin = hosted ? `https://${hosted[1]}.storage.supabase.co` : base;
  return `${origin}/storage/v1/upload/resumable`;
}

export function objectUploadUrl(supabaseUrl: string, bucket: string, objectPath: string): string {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${bucket}/${encoded}`;
}
