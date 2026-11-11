import { and, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

const MAX_TERMS = 6;

/** Escape LIKE wildcards so user text is matched literally. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Split a query into lower-cased search terms (bounded to keep the SQL small). */
export function searchTerms(query: string | undefined): string[] {
  if (!query) return [];
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

function likeEscaped(column: SQLiteColumn, pattern: string): SQL {
  return sql`${column} like ${pattern} escape '\\'`;
}

/**
 * Every term must match at least one of the columns (case-insensitive for ASCII, SQLite default).
 * Returns undefined when there is nothing to filter on.
 */
export function matchAllTerms(query: string | undefined, columns: SQLiteColumn[]): SQL | undefined {
  const terms = searchTerms(query);
  if (terms.length === 0) return undefined;
  const clauses = terms.map((term) => {
    const pattern = `%${escapeLike(term)}%`;
    return or(...columns.map((column) => likeEscaped(column, pattern)));
  });
  return and(...clauses);
}
