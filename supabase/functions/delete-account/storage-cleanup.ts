/**
 * Removes every object a user owns in a Storage bucket (`<uid>/...`, any depth).
 * Dependency-free; the bucket API is the subset of supabase-js `storage.from(bucket)` we need.
 */

export const LIST_PAGE_SIZE = 1000;
export const REMOVE_BATCH_SIZE = 100;

export interface StorageEntry {
  name: string;
  /** null for "folders" (common prefixes). */
  id: string | null;
}

export interface BucketApi {
  list(
    path: string,
    options: { limit: number; offset: number; sortBy: { column: string; order: string } },
  ): Promise<{ data: StorageEntry[] | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ data: unknown; error: { message: string } | null }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user folder prefix; refuses anything but a UUID so we can never list the bucket root. */
export function userPrefix(userId: string): string {
  if (!UUID_PATTERN.test(userId)) throw new Error('Invalid user id');
  return userId;
}

/** Depth-first listing of all object paths under `prefix`. */
export async function listObjectPaths(bucket: BucketApi, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  const folders = [prefix];
  while (folders.length > 0) {
    const folder = folders.pop() as string;
    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const { data, error } = await bucket.list(folder, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`storage list failed: ${error.message}`);
      const entries = data ?? [];
      for (const entry of entries) {
        const path = `${folder}/${entry.name}`;
        if (entry.id === null) folders.push(path);
        else paths.push(path);
      }
      if (entries.length < LIST_PAGE_SIZE) break;
    }
  }
  return paths;
}

/** Removes objects in batches; returns how many were removed. */
export async function removeObjects(bucket: BucketApi, paths: readonly string[]): Promise<number> {
  let removed = 0;
  for (let index = 0; index < paths.length; index += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(index, index + REMOVE_BATCH_SIZE);
    const { error } = await bucket.remove(batch);
    if (error) throw new Error(`storage remove failed: ${error.message}`);
    removed += batch.length;
  }
  return removed;
}

export async function deleteUserObjects(bucket: BucketApi, userId: string): Promise<number> {
  const paths = await listObjectPaths(bucket, userPrefix(userId));
  return removeObjects(bucket, paths);
}
