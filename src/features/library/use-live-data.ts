import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import { logger } from '@/lib/logger';

export interface LiveData<T> {
  data: T | undefined;
  error: Error | undefined;
}

function runRead<T>(read: () => T): LiveData<T> {
  try {
    return { data: read(), error: undefined };
  } catch (error) {
    logger.error('Reading local data failed', error);
    return { data: undefined, error: error instanceof Error ? error : new Error('Reading local data failed') };
  }
}

/**
 * Run a synchronous repository read and re-run it whenever one of `tables` changes
 * (expo-sqlite change listener). Use for reads that join or combine several tables,
 * where drizzle's `useLiveQuery` (single table) is not enough.
 * Keep `read` stable (useCallback or the React Compiler) so it only re-runs when inputs change.
 */
export function useLiveData<T>(read: () => T, tables: readonly string[]): LiveData<T> {
  const [version, setVersion] = useState(0);
  const tableKey = tables.join(',');

  useEffect(() => {
    const watched = new Set(tableKey.split(','));
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (watched.has(tableName)) setVersion((value) => value + 1);
    });
    return () => subscription.remove();
  }, [tableKey]);

  return useMemo(() => {
    void version;
    return runRead(read);
  }, [read, version]);
}
