/**
 * Test-only helper: a real in-memory SQLite database with the app's migrations applied.
 * Never import this from app code (better-sqlite3 is a Node-only dev dependency).
 */
import path from 'path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '../schema';
import type { AppDatabase } from '../types';

export function createTestDb(): AppDatabase {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', 'migrations') });
  return db;
}
