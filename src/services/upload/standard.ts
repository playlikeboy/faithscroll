/**
 * Single-request upload for small files (≤ one TUS chunk) using expo-file-system's native uploader,
 * which streams the file from disk (no JS memory copy) and can continue in the background on iOS.
 */
import { File, UploadType } from 'expo-file-system';

import { AiServiceError } from '@/services/ai/errors';

import { AUDIO_BUCKET, objectUploadUrl } from './paths';
import type { UploadContext, UploadFileInput } from './types';

export function uploadErrorFromStatus(status: number): AiServiceError {
  if (status === 401 || status === 403) return new AiServiceError('signed_out');
  if (status === 413) return new AiServiceError('audio_too_large');
  return new AiServiceError('upload_failed');
}

export async function uploadStandard(input: UploadFileInput, context: UploadContext): Promise<void> {
  const token = await context.getAccessToken();
  const file = new File(input.fileUri);
  let status: number;
  try {
    const result = await file.upload(objectUploadUrl(context.supabaseUrl, AUDIO_BUCKET, input.objectPath), {
      httpMethod: 'POST',
      uploadType: UploadType.BINARY_CONTENT,
      mimeType: input.contentType,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: context.anonKey,
        'Content-Type': input.contentType,
        'x-upsert': 'true',
        'cache-control': '3600',
      },
      onProgress: ({ bytesSent, totalBytes }) => input.onProgress?.(bytesSent, totalBytes || input.sizeBytes),
      signal: input.signal,
    });
    status = result.status;
  } catch (error) {
    if (input.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw new AiServiceError('cancelled');
    throw new AiServiceError('offline');
  }
  if (status < 200 || status >= 300) throw uploadErrorFromStatus(status);
}
