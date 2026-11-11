import { BOOKS, booksInTestament } from '../books';
import type { BibleBook, Testament } from '../types';

function normalise(value: string): string {
  return value.toLowerCase().replace(/[\s.]/g, '');
}

/** True when the query matches the book's name, short name or code ("1 cor", "1cor", "rom", "psalm"). */
export function bookMatches(book: BibleBook, query: string): boolean {
  const needle = normalise(query);
  if (!needle) return true;
  const name = normalise(book.name);
  return (
    name.includes(needle) ||
    normalise(book.shortName).startsWith(needle) ||
    book.code.toLowerCase().startsWith(needle) ||
    // "psalm" should find "Psalms"
    needle.startsWith(name.replace(/s$/, ''))
  );
}

/**
 * Books for the selector: the chosen testament when the query is empty, otherwise
 * matches across the whole Bible (so typing "John" works from either tab).
 */
export function filterBooks(query: string, testament: Testament): BibleBook[] {
  if (!query.trim()) return booksInTestament(testament);
  return BOOKS.filter((book) => bookMatches(book, query));
}
