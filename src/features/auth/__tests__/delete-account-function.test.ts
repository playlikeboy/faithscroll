/**
 * Unit tests for the dependency-free parts of the `delete-account` Edge Function (Deno code that
 * Jest can import because it has no runtime imports).
 */
import {
  HttpError,
  parseBearerToken,
  requireSecret,
  requireUser,
  type AuthVerifier,
} from '../../../../supabase/functions/_shared/auth';
import {
  deleteUserObjects,
  LIST_PAGE_SIZE,
  listObjectPaths,
  REMOVE_BATCH_SIZE,
  type BucketApi,
  type StorageEntry,
} from '../../../../supabase/functions/delete-account/storage-cleanup';

const UID = '3f6c1f7e-8a3b-4d0e-9a59-2f3f6b1d2c10';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';

/** In-memory bucket keyed by full object path. */
function createBucket(paths: string[]): BucketApi & { objects: Set<string>; removeCalls: string[][] } {
  const objects = new Set(paths);
  const removeCalls: string[][] = [];
  return {
    objects,
    removeCalls,
    async list(folder, { limit, offset }) {
      const children = new Map<string, StorageEntry>();
      for (const path of objects) {
        if (!path.startsWith(`${folder}/`)) continue;
        const rest = path.slice(folder.length + 1);
        const [head, ...tail] = rest.split('/');
        children.set(head, { name: head, id: tail.length > 0 ? null : `id-${path}` });
      }
      const sorted = [...children.values()].sort((a, b) => a.name.localeCompare(b.name));
      return { data: sorted.slice(offset, offset + limit), error: null };
    },
    async remove(batch) {
      removeCalls.push(batch);
      for (const path of batch) objects.delete(path);
      return { data: batch, error: null };
    },
  };
}

describe('delete-account storage cleanup', () => {
  test('finds nested objects under the user folder only', async () => {
    const bucket = createBucket([
      `${UID}/sermon-1/rec-1.m4a`,
      `${UID}/sermon-1/rec-2.m4a`,
      `${UID}/sermon-2/rec-3.m4a`,
      'other-user/sermon/rec.m4a',
    ]);

    const paths = await listObjectPaths(bucket, UID);

    expect(paths.sort()).toEqual([`${UID}/sermon-1/rec-1.m4a`, `${UID}/sermon-1/rec-2.m4a`, `${UID}/sermon-2/rec-3.m4a`]);
  });

  test('pages through large folders and removes in batches', async () => {
    const count = LIST_PAGE_SIZE + 150;
    const paths = Array.from({ length: count }, (_, i) => `${UID}/s/rec-${String(i).padStart(5, '0')}.m4a`);
    const bucket = createBucket([...paths, 'someone-else/x.m4a']);

    const removed = await deleteUserObjects(bucket, UID);

    expect(removed).toBe(count);
    expect([...bucket.objects]).toEqual(['someone-else/x.m4a']);
    expect(Math.max(...bucket.removeCalls.map((batch) => batch.length))).toBeLessThanOrEqual(REMOVE_BATCH_SIZE);
  });

  test('refuses a non-UUID user id so the bucket root can never be targeted', async () => {
    await expect(deleteUserObjects(createBucket(['a/b']), '')).rejects.toThrow('Invalid user id');
    await expect(deleteUserObjects(createBucket(['a/b']), '../')).rejects.toThrow('Invalid user id');
  });

  test('surfaces storage errors', async () => {
    const bucket = createBucket([`${UID}/a.m4a`]);
    bucket.remove = async () => ({ data: null, error: { message: 'denied' } });
    await expect(deleteUserObjects(bucket, UID)).rejects.toThrow('storage remove failed');
  });
});

describe('edge function auth helpers', () => {
  const request = (authorization?: string) =>
    ({ headers: { get: (name: string) => (name === 'Authorization' ? authorization ?? null : null) } }) as unknown as Request;

  const verifier = (user: { id: string } | null, error: { message: string } | null = null): AuthVerifier => ({
    auth: { getUser: jest.fn(async () => ({ data: { user }, error })) },
  });

  test('parses only well-formed bearer JWTs', () => {
    expect(parseBearerToken(`Bearer ${JWT}`)).toBe(JWT);
    expect(parseBearerToken(`bearer   ${JWT}`)).toBe(JWT);
    expect(parseBearerToken('Basic abc')).toBeNull();
    expect(parseBearerToken('Bearer not-a-jwt')).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });

  test('returns the verified user', async () => {
    const check = verifier({ id: UID });
    await expect(requireUser(request(`Bearer ${JWT}`), check)).resolves.toEqual({ id: UID, email: null });
    expect(check.auth.getUser).toHaveBeenCalledWith(JWT);
  });

  test('rejects missing or invalid tokens with 401', async () => {
    await expect(requireUser(request(), verifier({ id: UID }))).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    await expect(requireUser(request(`Bearer ${JWT}`), verifier(null, { message: 'expired' }))).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  test('requires secrets without revealing them', () => {
    expect(requireSecret(() => ' value ', 'X')).toBe('value');
    expect(() => requireSecret(() => undefined, 'X')).toThrow('This service is not configured.');
  });
});
