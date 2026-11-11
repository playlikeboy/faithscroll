import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Database type accepted by every repository function.
 * Satisfied by the expo-sqlite database in the app and by better-sqlite3 in tests,
 * so repositories are written once as `fn(db: AppDatabase, ...)` and tested against real SQLite.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDatabase = BaseSQLiteDatabase<'sync', any, typeof schema>;

export type Schema = typeof schema;
