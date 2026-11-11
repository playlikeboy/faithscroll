/**
 * Re-run a synchronous local-database read whenever any of the given tables change.
 * Unlike drizzle's `useLiveQuery` (one table), this watches every table a screen depends on
 * (e.g. entries + tags + links), coalescing bursts of row changes into one reload.
 */
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage, logger } from '@/lib/logger';

export interface LiveData<T> {
  /** Undefined until the first load completes. */
  data: T | undefined;
  error: Error | null;
  reload: () => void;
}

interface LiveState<T> {
  data: T | undefined;
  error: Error | null;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(getErrorMessage(error));
}

/**
 * @param load synchronous loader (repository call)
 * @param tables SQL table names to watch
 * @param key reload whenever this changes (serialize the loader's inputs into it)
 */
export function useLiveData<T>(load: () => T, tables: readonly string[], key: string): LiveData<T> {
  const [state, setState] = useState<LiveState<T>>({ data: undefined, error: null });
  const loadRef = useRef(load);
  const mountedRef = useRef(true);

  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const data = loadRef.current();
      setState({ data, error: null });
    } catch (caught) {
      logger.error('Loading local data failed', caught);
      setState((previous) => ({ data: previous.data, error: toError(caught) }));
    }
  }, []);

  const tablesKey = tables.join(',');

  useEffect(() => {
    mountedRef.current = true;
    run();
    const watched = new Set(tablesKey.split(','));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (!watched.has(tableName) || timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        run();
      }, 0);
    });
    return () => {
      mountedRef.current = false;
      if (timer !== null) clearTimeout(timer);
      subscription.remove();
    };
  }, [key, tablesKey, run]);

  return { data: state.data, error: state.error, reload: run };
}
