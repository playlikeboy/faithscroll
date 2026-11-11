/**
 * Test-only: runs Bible repository queries against the real assets/bible/bible.db with better-sqlite3.
 * Never import this from app code (better-sqlite3 is a Node-only dev dependency).
 *
 *   let restore: () => void;
 *   beforeAll(() => { restore = installBundledBibleForTests(); });
 *   afterAll(() => restore());
 */
import path from 'path';

import Database from 'better-sqlite3';

import { setBibleExecutor } from '../connection';
import type { BibleQueryExecutor, SqlParam } from '../executor';

export const BUNDLED_BIBLE_DB_PATH = path.join(__dirname, '..', '..', '..', '..', '..', 'assets', 'bible', 'bible.db');

export interface ClosableBibleQueryExecutor extends BibleQueryExecutor {
  close(): void;
}

export function createNodeBibleExecutor(file: string = BUNDLED_BIBLE_DB_PATH): ClosableBibleQueryExecutor {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  return {
    async getAll<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirst<T>(sql: string, params: readonly SqlParam[] = []): Promise<T | null> {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    close: () => db.close(),
  };
}

/** Points the Bible repository at the bundled database; returns a function that undoes it. */
export function installBundledBibleForTests(): () => void {
  const executor = createNodeBibleExecutor();
  setBibleExecutor(executor);
  return () => {
    setBibleExecutor(null);
    executor.close();
  };
}
