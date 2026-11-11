/**
 * Narrow, testable view of the Supabase Data API used by the sync engine.
 * All requests also filter on `user_id` (RLS enforces it anyway; the filter uses the cursor index).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type RemoteRow = Record<string, unknown>;

/** network/server/auth abort the current sync; rejected = the server refused this data. */
export type RemoteFailureKind = 'network' | 'auth' | 'server' | 'rejected';

export class SyncRemoteError extends Error {
  readonly kind: RemoteFailureKind;
  /** Short machine code (PostgREST/SQLSTATE code or HTTP status). Never contains row data. */
  readonly code: string;

  constructor(kind: RemoteFailureKind, code: string) {
    super(`sync ${kind} error (${code})`);
    this.name = 'SyncRemoteError';
    this.kind = kind;
    this.code = code;
  }
}

export interface PullCursor {
  ts: string;
  /** null = first page of a run: everything with server_updated_at >= ts. */
  id: string | null;
}

export interface SyncRemote {
  pullPage(table: string, columns: readonly string[], after: PullCursor | null, limit: number): Promise<RemoteRow[]>;
  /** Upserts rows and returns the rows actually written (stale versions are skipped by the server). */
  upsert(table: string, rows: RemoteRow[], onConflict: string, returning: string): Promise<RemoteRow[]>;
  fetchByIds(table: string, columns: readonly string[], ids: readonly string[]): Promise<RemoteRow[]>;
  /** Tombstones matching rows (used when the device no longer has the row). */
  markDeleted(table: string, match: Record<string, string>, deletedAt: string): Promise<void>;
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303']);

export function classifyRemoteError(error: PostgrestLikeError | null | undefined, status: number | undefined): SyncRemoteError {
  const code = error?.code && error.code.length > 0 ? error.code : String(status ?? 0);
  if (!status) return new SyncRemoteError('network', code);
  if (status === 401 || AUTH_CODES.has(code)) return new SyncRemoteError('auth', code);
  if (status >= 500 || status === 408 || status === 429) return new SyncRemoteError('server', code);
  return new SyncRemoteError('rejected', code);
}

interface QueryResult {
  data: unknown;
  error: PostgrestLikeError | null;
  status: number;
}

async function run(query: PromiseLike<QueryResult>): Promise<unknown> {
  let result: QueryResult;
  try {
    result = await query;
  } catch {
    throw new SyncRemoteError('network', 'fetch_failed');
  }
  if (result.error) throw classifyRemoteError(result.error, result.status);
  return result.data;
}

const quote = (value: string) => `"${value.replace(/"/g, '')}"`;

export function cursorFilter(after: PullCursor & { id: string }): string {
  const ts = quote(after.ts);
  return `server_updated_at.gt.${ts},and(server_updated_at.eq.${ts},id.gt.${after.id})`;
}

export function createSupabaseRemote(client: SupabaseClient, userId: string): SyncRemote {
  return {
    async pullPage(table, columns, after, limit) {
      let query = client.from(table).select(columns.join(',')).eq('user_id', userId);
      if (after?.id) query = query.or(cursorFilter({ ts: after.ts, id: after.id }));
      else if (after) query = query.gte('server_updated_at', after.ts);
      const data = await run(
        query.order('server_updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit) as unknown as PromiseLike<QueryResult>,
      );
      return (data ?? []) as RemoteRow[];
    },

    async upsert(table, rows, onConflict, returning) {
      if (rows.length === 0) return [];
      const data = await run(
        client.from(table).upsert(rows, { onConflict, ignoreDuplicates: false }).select(returning) as unknown as PromiseLike<QueryResult>,
      );
      return (data ?? []) as RemoteRow[];
    },

    async fetchByIds(table, columns, ids) {
      if (ids.length === 0) return [];
      const data = await run(
        client.from(table).select(columns.join(',')).eq('user_id', userId).in('id', [...ids]) as unknown as PromiseLike<QueryResult>,
      );
      return (data ?? []) as RemoteRow[];
    },

    async markDeleted(table, match, deletedAt) {
      await run(
        client
          .from(table)
          .update({ deleted_at: deletedAt, updated_at: deletedAt })
          .match({ ...match, user_id: userId })
          .is('deleted_at', null) as unknown as PromiseLike<QueryResult>,
      );
    },
  };
}
