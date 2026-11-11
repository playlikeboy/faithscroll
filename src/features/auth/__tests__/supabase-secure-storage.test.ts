import {
  CHUNK_MAX_BYTES,
  chunkByUtf8Bytes,
  createChunkedSecureStorage,
  utf8ByteLength,
  type SecureStoreLike,
} from '@/services/supabase/secure-storage';

function createMemoryStore(): SecureStoreLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: jest.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      if (!/^[\w.-]+$/.test(key)) throw new Error(`invalid key ${key}`);
      if (utf8ByteLength(value) > 2048) throw new Error('value too large for one entry');
      data.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

const KEY = 'sb-abcdef-auth-token';

describe('chunkByUtf8Bytes', () => {
  test('keeps every chunk within the byte limit and never splits a character', () => {
    const value = 'é🙏a'.repeat(500);
    const chunks = chunkByUtf8Bytes(value, 7);

    expect(chunks.join('')).toBe(value);
    for (const chunk of chunks) expect(utf8ByteLength(chunk)).toBeLessThanOrEqual(7);
  });

  test('returns a single empty chunk for an empty string', () => {
    expect(chunkByUtf8Bytes('', 10)).toEqual(['']);
  });

  test('rejects limits that cannot hold a 4-byte character', () => {
    expect(() => chunkByUtf8Bytes('abc', 3)).toThrow();
  });
});

describe('createChunkedSecureStorage', () => {
  test('stores small values under the key itself', async () => {
    const store = createMemoryStore();
    const storage = createChunkedSecureStorage(store, {});

    await storage.setItem(KEY, '{"small":true}');

    expect(store.data.get(KEY)).toBe('{"small":true}');
    expect(store.data.has(`${KEY}.n`)).toBe(false);
    await expect(storage.getItem(KEY)).resolves.toBe('{"small":true}');
  });

  test('splits values larger than 2 KB across chunk keys and reassembles them', async () => {
    const store = createMemoryStore();
    const storage = createChunkedSecureStorage(store, {});
    const session = JSON.stringify({ access_token: 'x'.repeat(5000), user: { name: 'Jöhn 🙏' } });

    await storage.setItem(KEY, session);

    const count = Number(store.data.get(`${KEY}.n`));
    expect(count).toBeGreaterThan(2);
    expect(store.data.has(KEY)).toBe(false);
    for (let i = 0; i < count; i += 1) {
      expect(utf8ByteLength(store.data.get(`${KEY}.${i}`) ?? '')).toBeLessThanOrEqual(CHUNK_MAX_BYTES);
    }
    await expect(storage.getItem(KEY)).resolves.toBe(session);
  });

  test('removes stale chunks when a large value shrinks', async () => {
    const store = createMemoryStore();
    const storage = createChunkedSecureStorage(store, {});

    await storage.setItem(KEY, 'a'.repeat(CHUNK_MAX_BYTES * 4));
    await storage.setItem(KEY, 'b'.repeat(CHUNK_MAX_BYTES + 1));

    expect(store.data.get(`${KEY}.n`)).toBe('2');
    expect(store.data.has(`${KEY}.2`)).toBe(false);
    expect(store.data.has(`${KEY}.3`)).toBe(false);
    await expect(storage.getItem(KEY)).resolves.toBe('b'.repeat(CHUNK_MAX_BYTES + 1));

    await storage.setItem(KEY, 'tiny');
    expect([...store.data.keys()]).toEqual([KEY]);
    await expect(storage.getItem(KEY)).resolves.toBe('tiny');
  });

  test('removeItem deletes the value and every chunk', async () => {
    const store = createMemoryStore();
    const storage = createChunkedSecureStorage(store, {});
    await storage.setItem(KEY, 'z'.repeat(CHUNK_MAX_BYTES * 3));

    await storage.removeItem(KEY);

    expect(store.data.size).toBe(0);
    await expect(storage.getItem(KEY)).resolves.toBeNull();
  });

  test('treats a value with a missing chunk as absent', async () => {
    const store = createMemoryStore();
    const storage = createChunkedSecureStorage(store, {});
    await storage.setItem(KEY, 'q'.repeat(CHUNK_MAX_BYTES * 2 + 5));
    store.data.delete(`${KEY}.1`);

    await expect(storage.getItem(KEY)).resolves.toBeNull();
  });

  test('sanitises characters SecureStore does not accept in keys', async () => {
    const store = createMemoryStore();
    const storage = createChunkedSecureStorage(store, {});

    await storage.setItem('weird key/with:chars', 'v');

    expect(store.data.get('weird_key_with_chars')).toBe('v');
    await expect(storage.getItem('weird key/with:chars')).resolves.toBe('v');
  });

  test('serialises concurrent writes so the last write wins', async () => {
    const store = createMemoryStore();
    const storage = createChunkedSecureStorage(store, {});

    await Promise.all([
      storage.setItem(KEY, 'first'.repeat(1000)),
      storage.setItem(KEY, 'second'),
    ]);

    await expect(storage.getItem(KEY)).resolves.toBe('second');
    expect(store.data.has(`${KEY}.n`)).toBe(false);
  });

  test('keeps working after a failed operation', async () => {
    const store = createMemoryStore();
    (store.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain locked'));
    const storage = createChunkedSecureStorage(store, {});

    await expect(storage.setItem(KEY, 'one')).rejects.toThrow('keychain locked');
    await storage.setItem(KEY, 'two');

    await expect(storage.getItem(KEY)).resolves.toBe('two');
  });
});
