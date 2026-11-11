import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';
import type { AppDatabase } from './types';

export const USER_DATABASE_NAME = 'faithscroll.db';

/** Raw expo-sqlite handle. `enableChangeListener` powers drizzle's `useLiveQuery`. */
export const expoDb = openDatabaseSync(USER_DATABASE_NAME, { enableChangeListener: true });
expoDb.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

/** The app's user database. Import this in hooks/screens; pass it into repository functions. */
export const db = drizzle(expoDb, { schema });

// Compile-time check that the expo database satisfies the shared repository type.
export const appDb: AppDatabase = db;
