export interface SyncStats {
  /** Remote rows written locally. */
  pulled: number;
  /** Local changes accepted by the server. */
  pushed: number;
  /** New entries in sync_conflicts (both copies kept). */
  conflicts: number;
  /** Remote rows parked until their parent arrives. */
  deferred: number;
  /** Local changes the server refused this run (retried with backoff). */
  failed: number;
}

export function emptyStats(): SyncStats {
  return { pulled: 0, pushed: 0, conflicts: 0, deferred: 0, failed: 0 };
}
