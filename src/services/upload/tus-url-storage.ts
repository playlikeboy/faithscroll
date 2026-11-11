/**
 * Persists TUS upload URLs (expo-sqlite kv-store) so an upload interrupted by the app being closed
 * can resume where it stopped (Supabase keeps upload URLs for up to 24 h).
 * Structurally implements tus-js-client's `UrlStorage` (not exported by its typings).
 */
import Storage from 'expo-sqlite/kv-store';

import { logger } from '@/lib/logger';

export interface StoredUpload {
  size: number | null;
  metadata: Record<string, string>;
  creationTime: string;
  urlStorageKey: string;
  uploadUrl: string | null;
  parallelUploadUrls: string[] | null;
}

export interface TusUrlStorage {
  findAllUploads(): Promise<StoredUpload[]>;
  findUploadsByFingerprint(fingerprint: string): Promise<StoredUpload[]>;
  removeUpload(urlStorageKey: string): Promise<void>;
  addUpload(fingerprint: string, upload: Omit<StoredUpload, 'urlStorageKey'> & { urlStorageKey?: string }): Promise<string>;
}

interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<unknown>;
}

const PREFIX = 'faithscroll.tus';
const INDEX_KEY = `${PREFIX}.index`;
/** Supabase upload URLs expire after 24 hours. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createKvUrlStorage(store: KeyValueStore = Storage): TusUrlStorage {
  async function readIndex(): Promise<string[]> {
    try {
      const raw = await store.getItem(INDEX_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
    } catch (error) {
      logger.warn('Upload resume index unreadable', { message: error instanceof Error ? error.message : 'unknown' });
      return [];
    }
  }

  async function readAll(): Promise<StoredUpload[]> {
    const keys = await readIndex();
    const now = Date.now();
    const uploads = await Promise.all(
      keys.map(async (key) => {
        const raw = await store.getItem(key);
        if (!raw) return null;
        try {
          const upload = { ...(JSON.parse(raw) as StoredUpload), urlStorageKey: key };
          return now - Date.parse(upload.creationTime) < MAX_AGE_MS ? upload : null;
        } catch {
          return null;
        }
      }),
    );
    return uploads.filter((upload): upload is StoredUpload => upload !== null);
  }

  return {
    findAllUploads: readAll,

    async findUploadsByFingerprint(fingerprint) {
      const uploads = await readAll();
      return uploads.filter((upload) => upload.urlStorageKey.startsWith(`${PREFIX}::${fingerprint}::`));
    },

    async removeUpload(urlStorageKey) {
      await store.removeItem(urlStorageKey);
      const keys = await readIndex();
      await store.setItem(INDEX_KEY, JSON.stringify(keys.filter((key) => key !== urlStorageKey)));
    },

    async addUpload(fingerprint, upload) {
      const key = `${PREFIX}::${fingerprint}::${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      await store.setItem(key, JSON.stringify({ ...upload, urlStorageKey: key }));
      const keys = await readIndex();
      await store.setItem(INDEX_KEY, JSON.stringify([...keys, key]));
      return key;
    },
  };
}
