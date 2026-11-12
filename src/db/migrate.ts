import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState } from 'react';

import { seedSampleContentOnce } from '@/features/seed';
import { logger } from '@/lib/logger';

import { db } from './client';
import migrations from './migrations/migrations';

let running: Promise<void> | null = null;

/** Seed the labelled sample library on a fresh install (no-op afterwards). Never blocks startup on failure. */
async function seedFirstLaunch(): Promise<void> {
  try {
    await seedSampleContentOnce(db);
  } catch (error) {
    logger.error('Seeding sample content failed', error);
  }
}

/**
 * Apply pending migrations exactly once per app process.
 *
 * drizzle's `useMigrations` starts a migration from an effect; React development mode runs effects
 * twice, and two overlapping migrations on one connection fail ("cannot start a transaction within
 * a transaction", then a failed ROLLBACK). Sharing one promise makes every caller wait for the same
 * run. A failed run is cleared so a later call can retry.
 */
export function runMigrationsOnce(): Promise<void> {
  running ??= migrate(db, migrations)
    .then(() => seedFirstLaunch())
    .catch((error: unknown) => {
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
