/**
 * Web build of the user database (dev preview only — iOS and Android are the release targets).
 *
 * On web, expo-sqlite runs SQLite (WebAssembly) in a worker and implements the synchronous API by
 * blocking on SharedArrayBuffer + Atomics with a short spin timeout. The very first call has to wait
 * for the worker to download and compile the WASM module, which exceeds that timeout
 * ("Sync operation timeout"). So on web the database is opened lazily: `prepareDatabase()` first
 * opens it asynchronously (no timeout) to warm the worker, then opens the synchronous connection
 * Drizzle needs. `db` / `expoDb` are proxies that become usable once `prepareDatabase()` resolves;
 * the root layout awaits it before rendering anything that touches the database.
 */
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import migrations from './migrations/migrations';
import * as schema from './schema';
import type { AppDatabase } from './types';

export const USER_DATABASE_NAME = 'faithscroll.db';

type DrizzleDb = ExpoSQLiteDatabase<typeof schema>;

let raw: SQLiteDatabase | null = null;
let drizzleDb: DrizzleDb | null = null;
let preparing: Promise<void> | null = null;

const MIGRATIONS_TABLE = '"__drizzle_migrations"';

/**
 * Apply pending migrations through the async API (no sync-call timeout), recording them in
 * drizzle's own table exactly as drizzle does, so drizzle's later synchronous `migrate()` finds
 * nothing left to run. Drizzle skips a migration when the latest `created_at` ≥ its `when`.
 */
async function migrateAsync(connection: SQLiteDatabase): Promise<void> {
  await connection.execAsync(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );
  const last = await connection.getFirstAsync<{ created_at: number }>(
    `SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`,
  );
  for (const entry of migrations.journal.entries) {
    if (last && Number(last.created_at) >= entry.when) continue;
    const sqlText = migrations.migrations[`m${String(entry.idx).padStart(4, '0')}`];
    if (!sqlText) throw new Error(`Migration ${entry.tag} is missing from the bundle`);
    const statements = sqlText
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);
    await connection.withTransactionAsync(async () => {
      for (const statement of statements) await connection.execAsync(statement);
      await connection.runAsync(`INSERT INTO ${MIGRATIONS_TABLE} ("hash", "created_at") VALUES (?, ?)`, [
        entry.tag,
        entry.when,
      ]);
    });
  }
}

/** Opens the database once the SQLite worker is ready. Safe to call repeatedly. */
export function prepareDatabase(): Promise<void> {
  preparing ??= (async () => {
    // Warm the worker, then release the file: browsers allow only one open access handle per
    // OPFS file, so the synchronous connection can only be opened once this one is closed.
    const warmup = await openDatabaseAsync(USER_DATABASE_NAME);
    await migrateAsync(warmup);
    await warmup.closeAsync();
    raw = openDatabaseSync(USER_DATABASE_NAME, { enableChangeListener: true });
    raw.execSync('PRAGMA foreign_keys = ON;');
    drizzleDb = drizzle(raw, { schema });
  })().catch((error: unknown) => {
    preparing = null; // allow a retry
    throw error;
  });
  return preparing;
}

function lazy<T extends object>(resolve: () => T | null, label: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const target = resolve();
      if (!target) throw new Error(`${label} was used before prepareDatabase() finished`);
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/** Raw expo-sqlite handle (available after `prepareDatabase()`). */
export const expoDb: SQLiteDatabase = lazy(() => raw, 'The database');

/** The app's user database (available after `prepareDatabase()`). */
export const db: DrizzleDb = lazy(() => drizzleDb, 'The database');

export const appDb: AppDatabase = db;
