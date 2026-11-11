import { File } from 'expo-file-system';

import { objectUploadUrl, recordingObjectPath, resumableEndpoint } from '../paths';
import { uploadErrorFromTus, uploadResumable } from '../resumable';
import { uploadStandard } from '../standard';
import { createKvUrlStorage } from '../tus-url-storage';
import { deleteCloudObjects, shouldUseResumable, uploadRecordingFile } from '../upload-recording';
import type { UploadContext } from '../types';
import { getSupabase } from '@/services/supabase/client';

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
}));
jest.mock('@/services/supabase/client', () => ({ getSupabase: jest.fn(), getSupabaseConfig: jest.fn(() => null) }));
jest.mock('@/services/ai/client', () => ({ getAccessToken: jest.fn(async () => 'jwt') }));
jest.mock('tus-js-client', () => ({ Upload: jest.fn() }));

const USER = '11111111-1111-4111-8111-111111111111';
const SERMON = '22222222-2222-4222-8222-222222222222';
const REC = '33333333-3333-4333-8333-333333333333';

const context: UploadContext = { supabaseUrl: 'https://abc123.supabase.co', anonKey: 'anon', getAccessToken: async () => 'jwt' };
const input = {
  fileUri: 'file:///docs/recordings/r.m4a',
  objectPath: `${USER}/${SERMON}/${REC}.m4a`,
  contentType: 'audio/mp4',
  sizeBytes: 10 * 1024 * 1024,
};

function memoryStore() {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => void map.set(key, value),
    removeItem: async (key: string) => map.delete(key),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('paths', () => {
  test('builds the per-user object path and rejects unsafe segments', () => {
    expect(recordingObjectPath(USER, SERMON, REC, `${REC}.m4a`)).toBe(`${USER}/${SERMON}/${REC}.m4a`);
    expect(recordingObjectPath(USER, SERMON, REC, null)).toBe(`${USER}/${SERMON}/${REC}.m4a`);
    expect(() => recordingObjectPath('../x', SERMON, REC)).toThrow();
  });

  test('uses the direct storage hostname for hosted projects', () => {
    expect(resumableEndpoint('https://abc123.supabase.co/')).toBe('https://abc123.storage.supabase.co/storage/v1/upload/resumable');
    expect(resumableEndpoint('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321/storage/v1/upload/resumable');
    expect(objectUploadUrl('https://abc123.supabase.co', 'sermon-audio', 'a/b c.m4a')).toBe(
      'https://abc123.supabase.co/storage/v1/object/sermon-audio/a/b%20c.m4a',
    );
  });
});

describe('createKvUrlStorage', () => {
  test('stores, finds by fingerprint and removes upload urls', async () => {
    const storage = createKvUrlStorage(memoryStore());
    const upload = { size: 1, metadata: {}, creationTime: new Date().toISOString(), uploadUrl: 'https://u/1', parallelUploadUrls: null };
    const key = await storage.addUpload('fp-1', upload);
    await storage.addUpload('fp-2', upload);

    expect(await storage.findUploadsByFingerprint('fp-1')).toEqual([{ ...upload, urlStorageKey: key }]);
    expect(await storage.findAllUploads()).toHaveLength(2);
    await storage.removeUpload(key);
    expect(await storage.findUploadsByFingerprint('fp-1')).toEqual([]);
  });

  test('ignores expired entries', async () => {
    const storage = createKvUrlStorage(memoryStore());
    await storage.addUpload('fp', { size: 1, metadata: {}, creationTime: '2020-01-01T00:00:00Z', uploadUrl: 'x', parallelUploadUrls: null });
    expect(await storage.findAllUploads()).toEqual([]);
  });
});

describe('uploadResumable', () => {
  function fakeUploadClass(behaviour: (options: Record<string, any>) => void, previous: unknown[] = []) {
    const instances: { file: unknown; options: Record<string, any>; resumed: unknown }[] = [];
    class FakeUpload {
      resumed: unknown = null;
      constructor(
        public file: unknown,
        public options: Record<string, any>,
      ) {
        instances.push(this as never);
      }
      start() {
        behaviour(this.options);
      }
      abort = jest.fn(async () => undefined);
      findPreviousUploads = async () => previous;
      resumeFromPreviousUpload(prev: unknown) {
        this.resumed = prev;
      }
    }
    return { FakeUpload, instances };
  }

  test('configures Supabase TUS (6 MB chunks, metadata, fresh token) and reports progress', async () => {
    const onProgress = jest.fn();
    const setHeader = jest.fn();
    const { FakeUpload, instances } = fakeUploadClass(async (options) => {
      await options.onBeforeRequest({ setHeader });
      options.onProgress(5, 10);
      options.onSuccess();
    }, ['previous-upload']);

    await uploadResumable({ ...input, onProgress }, context, { UploadClass: FakeUpload, urlStorage: createKvUrlStorage(memoryStore()) });

    const { file, options, resumed } = instances[0];
    expect(file).toEqual({ uri: input.fileUri, name: `${REC}.m4a`, type: 'audio/mp4', size: input.sizeBytes });
    expect(options.endpoint).toBe('https://abc123.storage.supabase.co/storage/v1/upload/resumable');
    expect(options.chunkSize).toBe(6 * 1024 * 1024);
    expect(options.metadata).toEqual({ bucketName: 'sermon-audio', objectName: input.objectPath, contentType: 'audio/mp4', cacheControl: '3600' });
    expect(options.headers).toEqual({ apikey: 'anon', 'x-upsert': 'true' });
    expect(await options.fingerprint()).toBe(`sermon-audio/${input.objectPath}:${input.sizeBytes}`);
    expect(setHeader).toHaveBeenCalledWith('authorization', 'Bearer jwt');
    expect(onProgress).toHaveBeenCalledWith(5, 10);
    expect(resumed).toBe('previous-upload');
  });

  test('maps failures to typed errors and supports cancellation', async () => {
    const failing = fakeUploadClass((options) => options.onError({ originalResponse: { getStatus: () => 403 } }));
    await expect(uploadResumable(input, context, { UploadClass: failing.FakeUpload, urlStorage: createKvUrlStorage(memoryStore()) })).rejects.toMatchObject({
      code: 'signed_out',
    });

    const controller = new AbortController();
    const hanging = fakeUploadClass(() => controller.abort());
    await expect(
      uploadResumable({ ...input, signal: controller.signal }, context, { UploadClass: hanging.FakeUpload, urlStorage: createKvUrlStorage(memoryStore()) }),
    ).rejects.toMatchObject({ code: 'cancelled' });

    expect(uploadErrorFromTus(new Error('network')).code).toBe('offline');
    expect(uploadErrorFromTus({ originalResponse: { getStatus: () => 413 } }).code).toBe('audio_too_large');
    expect(uploadErrorFromTus({ originalResponse: { getStatus: () => 500 } }).code).toBe('upload_failed');
  });
});

describe('uploadStandard', () => {
  test('posts the file as binary content with auth headers', async () => {
    const upload = jest.fn(async (_url: string, options: { onProgress: (p: { bytesSent: number; totalBytes: number }) => void }) => {
      options.onProgress({ bytesSent: 3, totalBytes: 4 });
      return { status: 200, body: '{}', headers: {} };
    });
    jest.mocked(File).mockImplementation(() => ({ upload }) as never);
    const onProgress = jest.fn();

    await uploadStandard({ ...input, sizeBytes: 4, onProgress }, context);

    expect(File).toHaveBeenCalledWith(input.fileUri);
    const [url, options] = upload.mock.calls[0] as unknown as [string, Record<string, any>];
    expect(url).toBe(`https://abc123.supabase.co/storage/v1/object/sermon-audio/${input.objectPath}`);
    expect(options.headers).toMatchObject({ Authorization: 'Bearer jwt', apikey: 'anon', 'x-upsert': 'true' });
    expect(options.uploadType).toBe(0);
    expect(onProgress).toHaveBeenCalledWith(3, 4);
  });

  test('maps HTTP and network failures', async () => {
    jest.mocked(File).mockImplementation(() => ({ upload: async () => ({ status: 413, body: '', headers: {} }) }) as never);
    await expect(uploadStandard(input, context)).rejects.toMatchObject({ code: 'audio_too_large' });
    jest.mocked(File).mockImplementation(() => ({ upload: async () => Promise.reject(new Error('net')) }) as never);
    await expect(uploadStandard(input, context)).rejects.toMatchObject({ code: 'offline' });
  });
});

describe('uploadRecordingFile / deleteCloudObjects', () => {
  test('chooses resumable above one chunk and rejects files over 25 MB', async () => {
    expect(shouldUseResumable(6 * 1024 * 1024)).toBe(false);
    expect(shouldUseResumable(6 * 1024 * 1024 + 1)).toBe(true);
    await expect(uploadRecordingFile({ ...input, sizeBytes: 26 * 1024 * 1024 }, context)).rejects.toMatchObject({ code: 'audio_too_large' });
  });

  test('reports not_configured without Supabase', async () => {
    await expect(uploadRecordingFile(input)).rejects.toMatchObject({ code: 'not_configured' });
    jest.mocked(getSupabase).mockReturnValue(null);
    await expect(deleteCloudObjects(['a'])).rejects.toMatchObject({ code: 'not_configured' });
  });

  test('removes cloud objects through the storage API', async () => {
    const remove = jest.fn(async () => ({ data: [], error: null }));
    jest.mocked(getSupabase).mockReturnValue({ storage: { from: () => ({ remove }) } } as never);
    await deleteCloudObjects(['u/s/r.m4a']);
    expect(remove).toHaveBeenCalledWith(['u/s/r.m4a']);
    await deleteCloudObjects([]);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
