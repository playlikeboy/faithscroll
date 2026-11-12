/**
 * App-side access to the bundled, read-only Bible database through expo-sqlite.
 *
 * On first use the asset (assets/bible/bible.db) is copied into the SQLite directory under a
 * versioned name (`bible-web-v2.db`), so a build that ships new Bible data under a new name never
 * reuses a stale copy. Copies left by older app versions are deleted to free space. One connection is opened lazily and shared; it is switched to query-only.
 */
import { deleteDatabaseAsync, importDatabaseFromAssetAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { logger } from '@/lib/logger';

import { BIBLE_DATABASE_NAME, BIBLE_SCHEMA_VERSION, type BibleQueryExecutor, type SqlParam } from './executor';

// Metro resolves this to an asset id (metro.config.js lists `db` as an asset extension).
const BIBLE_ASSET_ID: number = require('../../../../assets/bible/bible.db');

async function hasExpectedSchema(db: SQLiteDatabase): Promise<boolean> {
  try {
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM metadata WHERE key = 'schema_version'");
    return row?.value === String(BIBLE_SCHEMA_VERSION);
  } catch (error) {
    logger.warn('Bible database copy failed validation; replacing it', { error: String(error) });
    return false;
  }
}

async function importAndOpen(forceOverwrite: boolean): Promise<SQLiteDatabase> {
  await importDatabaseFromAssetAsync(BIBLE_DATABASE_NAME, { assetId: BIBLE_ASSET_ID, forceOverwrite });
  return openDatabaseAsync(BIBLE_DATABASE_NAME);
}

async function openBibleDatabase(): Promise<SQLiteDatabase> {
  let db = await importAndOpen(false);
  if (!(await hasExpectedSchema(db))) {
    // A partial copy (e.g. the app was killed mid-copy) or a mismatched file: copy it again once.
    await db.closeAsync();
    db = await importAndOpen(true);
    if (!(await hasExpectedSchema(db))) throw new Error('The bundled Bible text could not be opened.');
  }
  await db.execAsync('PRAGMA query_only = ON');
  return db;
}

/** Removes copies made by older app versions (bible-web-v1.db …). Missing files are expected. */
export async function deleteStaleBibleCopies(): Promise<void> {
  for (let version = 1; version < BIBLE_SCHEMA_VERSION; version += 1) {
    try {
      await deleteDatabaseAsync(`bible-web-v${version}.db`);
    } catch (error) {
      logger.debug('No stale Bible copy to delete', { version, error: String(error) });
    }
  }
}

let connection: Promise<SQLiteDatabase> | null = null;

function getConnection(): Promise<SQLiteDatabase> {
  if (!connection) {
    connection = openBibleDatabase()
      .then((db) => {
        void deleteStaleBibleCopies();
        return db;
      })
      .catch((error: unknown) => {
        connection = null; // allow a later retry
        logger.error('Could not open the Bible database', error);
        throw error;
      });
  }
  return connection;
}

export function createExpoBibleExecutor(): BibleQueryExecutor {
  return {
    async getAll<T>(sql: string, params: readonly SqlParam[] = []): Promise<T[]> {
      const db = await getConnection();
      return db.getAllAsync<T>(sql, [...params]);
    },
    async getFirst<T>(sql: string, params: readonly SqlParam[] = []): Promise<T | null> {
      const db = await getConnection();
      return db.getFirstAsync<T>(sql, [...params]);
    },
  };
}
