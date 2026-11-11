/**
 * Reactive read of the local database that refreshes when any of the watched tables change.
 * Unlike drizzle's `useLiveQuery`, it works with repository functions that join or sub-query
 * several tables (e.g. the sermon list reads recordings, transcripts and recaps too).
 */
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getErrorMessage, logger } from '@/lib/logger';

const COALESCE_MS = 16;

export interface DbQueryResult<T> {
  data: T;
  error: Error | null;
  refresh: () => void;
}

interface QueryState<T> {
  data: T;
  error: Error | null;
}

function runRead<T>(read: () => T, fallback: T): QueryState<T> {
  try {
    return { data: read(), error: null };
  } catch (caught) {
    logger.error('Local database read failed', caught);
    return { data: fallback, error: caught instanceof Error ? caught : new Error(getErrorMessage(caught)) };
  }
}

function subscribeToTables(tables: ReadonlySet<string>, onChange: () => void): () => void {
  try {
    const subscription = addDatabaseChangeListener(({ tableName }) => {
      if (tables.has(tableName)) onChange();
    });
    return () => subscription.remove();
  } catch (caught) {
    logger.warn('Database change listener unavailable', { message: getErrorMessage(caught) });
    return () => undefined;
  }
}

/**
 * @param read synchronous repository call, e.g. `() => listSermons(db, options)`
 * @param tables table names whose changes should trigger a re-read
 * @param key changes whenever the inputs of `read` change (e.g. `JSON.stringify(options)`)
 * @param fallback value used before the first read and after a failed one
 */
export function useDbQuery<T>(read: () => T, tables: readonly string[], key: string, fallback: T): DbQueryResult<T> {
  const readRef = useRef(read);
  const fallbackRef = useRef(fallback);
  const [state, setState] = useState<QueryState<T>>(() => runRead(read, fallback));
  const [version, setVersion] = useState(0);
  const tablesKey = tables.join(',');

  useEffect(() => {
    readRef.current = read;
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      timer = null;
      if (!cancelled) setState((previous) => runRead(readRef.current, previous.data ?? fallbackRef.current));
    };
    reload();
    const unsubscribe = subscribeToTables(new Set(tablesKey.split(',')), () => {
      if (timer === null) timer = setTimeout(reload, COALESCE_MS);
    });
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      unsubscribe();
    };
  }, [key, tablesKey, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { data: state.data, error: state.error, refresh };
}
