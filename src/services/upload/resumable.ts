/**
 * Resumable (TUS) upload to Supabase Storage with tus-js-client.
 * React Native: tus-js-client's browser build accepts `{ uri, name, type, size }` and reads the
 * file as a Blob through XMLHttpRequest, so no custom file reader is needed.
 */
import { Upload } from 'tus-js-client';

import { AiServiceError } from '@/services/ai/errors';

import { AUDIO_BUCKET, resumableEndpoint, TUS_CHUNK_SIZE } from './paths';
import { createKvUrlStorage, type TusUrlStorage } from './tus-url-storage';
import type { UploadContext, UploadFileInput } from './types';

const RETRY_DELAYS_MS = [0, 3_000, 5_000, 10_000, 20_000];

interface TusRequest {
  setHeader(name: string, value: string): void;
}

interface TusUploadLike {
  start(): void;
  abort(shouldTerminate?: boolean): Promise<void>;
  findPreviousUploads(): Promise<unknown[]>;
  resumeFromPreviousUpload(previous: unknown): void;
}

type UploadConstructor = new (file: unknown, options: Record<string, unknown>) => TusUploadLike;

interface ResumableDeps {
  UploadClass?: UploadConstructor;
  urlStorage?: TusUrlStorage;
}

let sharedUrlStorage: TusUrlStorage | null = null;

function defaultUrlStorage(): TusUrlStorage {
  sharedUrlStorage = sharedUrlStorage ?? createKvUrlStorage();
  return sharedUrlStorage;
}

function statusOf(error: unknown): number | null {
  const response = (error as { originalResponse?: { getStatus?: () => number } | null }).originalResponse;
  return typeof response?.getStatus === 'function' ? response.getStatus() : null;
}

export function uploadErrorFromTus(error: unknown): AiServiceError {
  const status = statusOf(error);
  if (status === null) return new AiServiceError('offline');
  if (status === 401 || status === 403) return new AiServiceError('signed_out');
  if (status === 413) return new AiServiceError('audio_too_large');
  return new AiServiceError('upload_failed');
}

export function uploadResumable(input: UploadFileInput, context: UploadContext, deps: ResumableDeps = {}): Promise<void> {
  const UploadClass = deps.UploadClass ?? (Upload as unknown as UploadConstructor);
  const fileName = input.objectPath.split('/').pop() ?? 'audio.m4a';

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: AiServiceError) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    const upload = new UploadClass(
      { uri: input.fileUri, name: fileName, type: input.contentType, size: input.sizeBytes },
      {
        endpoint: resumableEndpoint(context.supabaseUrl),
        retryDelays: RETRY_DELAYS_MS,
        chunkSize: TUS_CHUNK_SIZE,
        uploadSize: input.sizeBytes,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        storeFingerprintForResuming: true,
        urlStorage: deps.urlStorage ?? defaultUrlStorage(),
        // Stable across app restarts: same object + same size = same upload.
        fingerprint: async () => `${AUDIO_BUCKET}/${input.objectPath}:${input.sizeBytes}`,
        headers: { apikey: context.anonKey, 'x-upsert': 'true' },
        metadata: {
          bucketName: AUDIO_BUCKET,
          objectName: input.objectPath,
          contentType: input.contentType,
          cacheControl: '3600',
        },
        onBeforeRequest: async (request: TusRequest) => {
          request.setHeader('authorization', `Bearer ${await context.getAccessToken()}`);
        },
        onProgress: (sent: number, total: number) => input.onProgress?.(sent, total || input.sizeBytes),
        onError: (error: unknown) => finish(uploadErrorFromTus(error)),
        onSuccess: () => finish(),
      },
    );

    input.signal?.addEventListener('abort', () => {
      void upload.abort().catch(() => undefined);
      finish(new AiServiceError('cancelled'));
    });

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!settled) upload.start();
      });
  });
}
