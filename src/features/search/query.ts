/** Query parsing and LIKE helpers for universal search. */
import { sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

export const MAX_QUERY_LENGTH = 200;
export const MAX_TERMS = 6;
export const MIN_QUERY_LENGTH = 2;

/** Collapse whitespace, trim and cap the length of a raw query. */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

/** Distinct search terms (every term must match somewhere). Quotes group a phrase: "living water". */
export function splitTerms(query: string): string[] {
  const terms: string[] = [];
  const pattern = /"([^"]+)"|(\S+)/g;
  for (const match of query.matchAll(pattern)) {
    const term = (match[1] ?? match[2] ?? '').trim().toLowerCase();
    if (term && !terms.includes(term)) terms.push(term);
  }
  return terms.slice(0, MAX_TERMS);
}

/** True when the query is long enough to search personal content. */
export function isSearchable(query: string): boolean {
  return normalizeQuery(query).replace(/"/g, '').length >= MIN_QUERY_LENGTH;
}

/** Escape LIKE wildcards (`%`, `_`) and the escape character itself so input matches literally. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Case-insensitive (ASCII) "contains" on a column or SQL expression, with wildcards escaped. */
export function contains(column: SQLiteColumn | SQL, term: string): SQL {
  return sql`${column} LIKE ${`%${escapeLike(term)}%`} ESCAPE '\\'`;
}

/** Every term must match at least one of the term's conditions (AND of ORs). */
export function allTermsMatch(terms: readonly string[], conditionsFor: (term: string) => SQL[]): SQL {
  const perTerm = terms.map((term) => sql`(${sql.join(conditionsFor(term), sql` or `)})`);
  return sql.join(perTerm, sql` and `);
}
