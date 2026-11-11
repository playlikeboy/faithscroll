/**
 * Test-only in-memory stand-in for the Supabase Data API, mimicking the parts of PostgREST and of
 * the sync mirror triggers the engine relies on:
 * - RLS (rows visible/writable only for the signed-in user),
 * - `server_updated_at` set on every write (microsecond strings like Postgres),
 * - the version guard (stale updates are skipped and absent from the returned rows),
 * - tombstone updates without a version bump the version themselves,
 * - entity_tags upserted on its natural key with a server-generated id.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

export interface InjectedFailure {
  kind: 'network' | 'server' | 'rejected' | 'auth';
  /** Only fail requests for this table/operation. */
  table?: string;
  op?: 'select' | 'upsert' | 'update';
  /** Only fail when a written payload row matches. */
  rowMatches?: (row: Row) => boolean;
  /** How many matching requests fail (default 1; Infinity = always). */
  times?: number;
}

const START_MICROS = Date.parse('2026-11-11T09:00:00.000Z') * 1000;

export function formatMicros(micros: number): string {
  const ms = Math.floor(micros / 1000);
  const fraction = String(micros % 1_000_000).padStart(6, '0');
  return `${new Date(ms).toISOString().slice(0, 19)}.${fraction}+00:00`;
}

function micros(ts: string): number {
  const match = /^(.+T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(.*)$/.exec(ts);
  if (!match) return Number.NaN;
  const offset = match[3] === '' ? 'Z' : match[3];
  return Date.parse(`${match[1]}${offset}`) * 1000 + Number((match[2] ?? '').padEnd(6, '0').slice(0, 6));
}

function compareValues(a: unknown, b: unknown, column: string): number {
  if (column === 'server_updated_at') return micros(String(a)) - micros(String(b));
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export class FakeSupabaseServer {
  readonly tables = new Map<string, Map<string, Row>>();
  userId: string;
  requests: { table: string; op: string }[] = [];
  private clock = START_MICROS;
  private failures: InjectedFailure[] = [];
  private nextId = 1;

  constructor(userId: string) {
    this.userId = userId;
  }

  tick(): string {
    this.clock += 7;
    return formatMicros(this.clock);
  }

  table(name: string): Map<string, Row> {
    let table = this.tables.get(name);
    if (!table) {
      table = new Map();
      this.tables.set(name, table);
    }
    return table;
  }

  rows(name: string): Row[] {
    return [...this.table(name).values()];
  }

  get(name: string, id: string): Row | undefined {
    return this.table(name).get(id);
  }

  /** Write a row as another device would (full trigger semantics). */
  seed(name: string, row: Row): Row {
    const written = this.write(name, { user_id: this.userId, ...row }, name === 'entity_tags' ? 'natural' : 'id');
    if (!written) throw new Error('seed write was skipped by the version guard');
    return written;
  }

  failNext(failure: InjectedFailure): void {
    this.failures.push({ times: 1, ...failure });
  }

  takeFailure(table: string, op: 'select' | 'upsert' | 'update', payload: Row[]): InjectedFailure | null {
    const index = this.failures.findIndex(
      (f) =>
        (!f.table || f.table === table) &&
        (!f.op || f.op === op) &&
        (!f.rowMatches || payload.some((row) => f.rowMatches?.(row))),
    );
    if (index < 0) return null;
    const failure = this.failures[index];
    const remaining = (failure.times ?? 1) - 1;
    if (remaining <= 0) this.failures.splice(index, 1);
    else this.failures[index] = { ...failure, times: remaining };
    return failure;
  }

  private naturalKey(row: Row): string {
    return [row.user_id, row.entity_type, row.entity_id, row.tag_id].map(String).join('|');
  }

  private findExisting(name: string, row: Row, conflict: 'id' | 'natural'): Row | undefined {
    if (conflict === 'id') return this.table(name).get(String(row.id));
    const key = this.naturalKey(row);
    return this.rows(name).find((existing) => this.naturalKey(existing) === key);
  }

  /** Insert or update one row; returns the stored row, or null when the version guard skipped it. */
  write(name: string, payload: Row, conflict: 'id' | 'natural'): Row | null {
    const existing = this.findExisting(name, payload, conflict);
    const versioned = name !== 'entity_tags';
    if (existing) {
      const next: Row = { ...existing, ...payload };
      if (versioned) {
        const newVersion = Number(next.version);
        const oldVersion = Number(existing.version);
        if (newVersion <= oldVersion) {
          const tombstone = newVersion === oldVersion && next.deleted_at != null && existing.deleted_at == null;
          if (!tombstone) return null;
          next.version = oldVersion + 1;
        }
      }
      next.server_updated_at = this.tick();
      this.table(name).set(String(existing.id), next);
      return next;
    }
    const id = payload.id ?? `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, '0')}`;
    const inserted: Row = {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      version: 1,
      ...payload,
      id,
      server_updated_at: this.tick(),
    };
    this.table(name).set(String(id), inserted);
    return inserted;
  }
}

type Result = { data: unknown; error: { code: string; message: string } | null; status: number };

const FAILURE_RESULTS: Record<InjectedFailure['kind'], Result> = {
  network: { data: null, error: { code: '', message: 'TypeError: Network request failed' }, status: 0 },
  server: { data: null, error: { code: '503', message: 'Service unavailable' }, status: 503 },
  rejected: { data: null, error: { code: '22P02', message: 'invalid input syntax' }, status: 400 },
  auth: { data: null, error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 },
};

const CURSOR_PATTERN = /^server_updated_at\.gt\."([^"]+)",and\(server_updated_at\.eq\."([^"]+)",id\.gt\.([^)]+)\)$/;

class FakeQuery implements PromiseLike<Result> {
  private op: 'select' | 'upsert' | 'update' = 'select';
  private columns: string[] | null = null;
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private payload: Row[] = [];
  private onConflict = 'id';

  constructor(
    private readonly server: FakeSupabaseServer,
    private readonly tableName: string,
  ) {}

  select(columns: string): this {
    this.columns = columns.split(',').map((c) => c.trim());
    return this;
  }

  upsert(rows: Row[], options: { onConflict?: string } = {}): this {
    this.op = 'upsert';
    this.payload = rows;
    this.onConflict = options.onConflict ?? 'id';
    return this;
  }

  update(values: Row): this {
    this.op = 'update';
    this.payload = [values];
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  gte(column: string, value: string): this {
    this.filters.push((row) => compareValues(row[column], value, column) >= 0);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  is(column: string, value: null): this {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  match(values: Row): this {
    for (const [column, value] of Object.entries(values)) this.eq(column, value);
    return this;
  }

  or(filter: string): this {
    const match = CURSOR_PATTERN.exec(filter);
    if (!match) throw new Error(`Unsupported or() filter: ${filter}`);
    const [, ts, , id] = match;
    this.filters.push((row) => {
      const diff = compareValues(row.server_updated_at, ts, 'server_updated_at');
      return diff > 0 || (diff === 0 && String(row.id) > id);
    });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private project(rows: Row[]): Row[] {
    const columns = this.columns;
    if (!columns || columns.includes('*')) return rows.map((row) => ({ ...row }));
    return rows.map((row) => Object.fromEntries(columns.map((c) => [c, row[c] ?? null])));
  }

  private visible(): Row[] {
    return this.server.rows(this.tableName).filter((row) => row.user_id === this.server.userId);
  }

  private execute(): Result {
    this.server.requests.push({ table: this.tableName, op: this.op });
    const failure = this.server.takeFailure(this.tableName, this.op, this.payload);
    if (failure) return FAILURE_RESULTS[failure.kind];

    if (this.op === 'select') {
      let rows = this.visible().filter((row) => this.filters.every((f) => f(row)));
      rows = [...rows].sort((a, b) => {
        for (const { column, ascending } of this.orders) {
          const diff = compareValues(a[column], b[column], column);
          if (diff !== 0) return ascending ? diff : -diff;
        }
        return 0;
      });
      if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
      return { data: this.project(rows), error: null, status: 200 };
    }

    if (this.op === 'upsert') {
      if (this.payload.some((row) => row.user_id !== this.server.userId)) {
        return { data: null, error: { code: '42501', message: 'row-level security' }, status: 403 };
      }
      const conflict = this.onConflict === 'id' ? 'id' : 'natural';
      const written = this.payload
        .map((row) => this.server.write(this.tableName, row, conflict))
        .filter((row): row is Row => row !== null);
      return { data: this.project(written), error: null, status: 201 };
    }

    const targets = this.visible().filter((row) => this.filters.every((f) => f(row)));
    const updated = targets
      .map((row) => this.server.write(this.tableName, { ...row, ...this.payload[0] }, 'id'))
      .filter((row): row is Row => row !== null);
    return { data: this.project(updated), error: null, status: 200 };
  }
}

export function createFakeSupabase(userId: string): { client: SupabaseClient; server: FakeSupabaseServer } {
  const server = new FakeSupabaseServer(userId);
  const client = { from: (table: string) => new FakeQuery(server, table) };
  return { client: client as unknown as SupabaseClient, server };
}
