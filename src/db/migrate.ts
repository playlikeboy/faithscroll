import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState } from 'react';

import { db } from './client';
import migrations from './migrations/migrations';

let running: Promise<void> | null = null;

/**
 * Apply pending migrations exactly once per app process.
 *
 * drizzle's `useMigrations` starts a migration from an effect; React development mode runs effects
 * twice, and two overlapping migrations on one connection fail ("cannot start a transaction within
 * a transaction", then a failed ROLLBACK). Sharing one promise makes every caller wait for the same
 * run. A failed run is cleared so a later call can retry.
 */
export function runMigrationsOnce(): Promise<void> {
  running ??= migrate(db, migrations).catch((error: unknown) => {
    running = null;
    throw error;
  });
  return running;
}

export interface MigrationState {
  success: boolean;
  error: Error | null;
}

export function useDatabaseMigrations(): MigrationState {
  const [state, setState] = useState<MigrationState>({ success: false, error: null });
  useEffect(() => {
    let isActive = true;
    runMigrationsOnce().then(
      () => isActive && setState({ success: true, error: null }),
      (error: unknown) => isActive && setState({ success: false, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      isActive = false;
    };
  }, []);
  return state;
}
