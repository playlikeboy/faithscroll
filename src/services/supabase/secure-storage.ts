/**
 * Supabase auth storage backed by the iOS Keychain / Android Keystore (expo-secure-store).
 *
 * SecureStore is meant for small values (Android historically warned above 2048 bytes), while a
 * Supabase session (access + refresh token + user JSON) is often larger. Values above
 * CHUNK_MAX_BYTES are split across `<key>.0`, `<key>.1`, … with the chunk count in `<key>.n`.
 * Small values are stored under `<key>` itself.
 */
import * as SecureStore from 'expo-secure-store';

/** Max UTF-8 bytes stored per SecureStore entry (kept safely under 2 KB). */
export const CHUNK_MAX_BYTES = 2000;

export interface SecureStoreLike {
  getItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
}

/** Shape expected by `createClient({ auth: { storage } })`. */
export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** Split a string into pieces of at most `maxBytes` UTF-8 bytes without breaking characters. */
export function chunkByUtf8Bytes(value: string, maxBytes: number): string[] {
  if (maxBytes < 4) throw new Error('maxBytes must be at least 4');
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of value) {
    const bytes = utf8Length(char.codePointAt(0) ?? 0);
    if (currentBytes + bytes > maxBytes) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  if (current.length > 0 || chunks.length === 0) chunks.push(current);
  return chunks;
}

export function utf8ByteLength(value: string): number {
  let total = 0;
  for (const char of value) total += utf8Length(char.codePointAt(0) ?? 0);
  return total;
}

/** SecureStore keys may only contain alphanumerics, '.', '-' and '_'. */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

function parseCount(raw: string | null): number {
  if (raw === null) return 0;
  const count = Number.parseInt(raw, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function createChunkedSecureStorage(
  store: SecureStoreLike = SecureStore,
  options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY },
): AuthStorage {
  // Serialise operations so a read never observes a half-written chunk set.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  async function deleteChunks(key: string, from: number, to: number): Promise<void> {
    for (let index = from; index < to; index += 1) {
      await store.deleteItemAsync(chunkKey(key, index), options);
    }
  }

  async function read(rawKey: string): Promise<string | null> {
    const key = safeKey(rawKey);
    const count = parseCount(await store.getItemAsync(countKey(key), options));
    if (count === 0) return store.getItemAsync(key, options);
    const parts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const part = await store.getItemAsync(chunkKey(key, index), options);
      // A missing chunk means the value is corrupt; treat it as absent (user signs in again).
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  }

  async function write(rawKey: string, value: string): Promise<void> {
    const key = safeKey(rawKey);
    const previousCount = parseCount(await store.getItemAsync(countKey(key), options));
    if (utf8ByteLength(value) <= CHUNK_MAX_BYTES) {
      await store.setItemAsync(key, value, options);
      if (previousCount > 0) {
        await store.deleteItemAsync(countKey(key), options);
        await deleteChunks(key, 0, previousCount);
      }
      return;
    }
    const chunks = chunkByUtf8Bytes(value, CHUNK_MAX_BYTES);
    for (let index = 0; index < chunks.length; index += 1) {
      await store.setItemAsync(chunkKey(key, index), chunks[index], options);
    }
    await store.setItemAsync(countKey(key), String(chunks.length), options);
    await deleteChunks(key, chunks.length, previousCount);
    await store.deleteItemAsync(key, options);
  }

  async function remove(rawKey: string): Promise<void> {
    const key = safeKey(rawKey);
    const count = parseCount(await store.getItemAsync(countKey(key), options));
    await deleteChunks(key, 0, count);
    await store.deleteItemAsync(countKey(key), options);
    await store.deleteItemAsync(key, options);
  }

  return {
    getItem: (key) => serial(() => read(key)),
    setItem: (key, value) => serial(() => write(key, value)),
    removeItem: (key) => serial(() => remove(key)),
  };
}
