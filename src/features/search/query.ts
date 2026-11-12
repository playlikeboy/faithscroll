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

/**
 * A query term and the words that may stand in for it: `[term, ...synonyms]`.
 * A plain string is a group of one.
 */
export type TermGroup = readonly string[];

/** One group per term: the term plus close synonyms from the concept map ("anxiety" → worry, anxious…). */
export function expandTerms(terms: readonly string[], synonymsFor: (term: string) => string[]): TermGroup[] {
  return terms.map((term) => {
    const synonyms = synonymsFor(term);
    return synonyms.length > 0 ? synonyms : [term];
  });
}

/**
 * Every term (group) must match at least one condition of at least one of its words
 * (AND across groups of ORs).
 */
export function allTermsMatch(terms: readonly (string | TermGroup)[], conditionsFor: (term: string) => SQL[]): SQL {
  const perTerm = terms.map((group) => {
    const words = typeof group === 'string' ? [group] : group;
    return sql`(${sql.join(words.flatMap(conditionsFor), sql` or `)})`;
  });
  return sql.join(perTerm, sql` and `);
}
