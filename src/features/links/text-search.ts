import { sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

/** Escape LIKE wildcards so user input is matched literally. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Case-insensitive (ASCII) "contains" match on a text column, with wildcards escaped. */
export function containsText(column: SQLiteColumn, term: string): SQL {
  return sql`${column} LIKE ${`%${escapeLike(term)}%`} ESCAPE '\\'`;
}

export function normalizeSearchTerm(term: string | null | undefined): string {
  return (term ?? '').replace(/\s+/g, ' ').trim();
}
