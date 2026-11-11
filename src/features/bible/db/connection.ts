/**
 * Which executor the Bible repository uses. Defaults to the bundled database via expo-sqlite;
 * tests (or previews) can swap in another executor with `setBibleExecutor`.
 */
import type { BibleQueryExecutor } from './executor';
import { createExpoBibleExecutor } from './expo-executor';

let override: BibleQueryExecutor | null = null;
let appExecutor: BibleQueryExecutor | null = null;

export function getBibleExecutor(): BibleQueryExecutor {
  if (override) return override;
  appExecutor ??= createExpoBibleExecutor();
  return appExecutor;
}

/** Replace the executor (pass null to restore the default). Intended for tests. */
export function setBibleExecutor(executor: BibleQueryExecutor | null): void {
  override = executor;
}

/**
 * Copies and opens the bundled database ahead of first use (e.g. during app start), so the first
 * chapter renders without waiting for the copy. Safe to call repeatedly.
 */
export async function prepareBibleDatabase(): Promise<void> {
  await getBibleExecutor().getFirst('SELECT 1 AS ready');
}
