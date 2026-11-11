/**
 * Tiny read-only query interface over the bundled Bible database.
 * The app uses expo-sqlite (`expo-executor.ts`); Jest uses better-sqlite3 against the same file
 * (`testing/node-executor.ts`), so repository code runs unchanged in both.
 */
export type SqlParam = string | number | null;

export interface BibleQueryExecutor {
  getAll<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  getFirst<T>(sql: string, params?: readonly SqlParam[]): Promise<T | null>;
}

/** Bump with the database schema/content version so a new app build replaces the cached copy. */
export const BIBLE_SCHEMA_VERSION = 1;
export const BIBLE_DATABASE_NAME = `bible-web-v${BIBLE_SCHEMA_VERSION}.db`;
