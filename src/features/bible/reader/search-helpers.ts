import type { BibleBook, DiscoverTopic, VerseRange } from '../types';
import { BOOKS } from '../books';
import { parseReference } from '../reference';
import { bookMatches } from './book-search';

export interface SnippetSegment {
  text: string;
  isMatch: boolean;
}

const MATCH_OPEN = '«';
const MATCH_CLOSE = '»';

/** Split an FTS snippet with «match» markers into plain and matched segments. */
export function parseSnippet(snippet: string): SnippetSegment[] {
  const segments: SnippetSegment[] = [];
  let rest = snippet;
  while (rest.length > 0) {
    const open = rest.indexOf(MATCH_OPEN);
    const close = open >= 0 ? rest.indexOf(MATCH_CLOSE, open + 1) : -1;
    if (open < 0 || close < 0) {
      segments.push({ text: rest.replaceAll(MATCH_OPEN, '').replaceAll(MATCH_CLOSE, ''), isMatch: false });
      break;
    }
    if (open > 0) segments.push({ text: rest.slice(0, open), isMatch: false });
    if (close > open + 1) segments.push({ text: rest.slice(open + 1, close), isMatch: true });
    rest = rest.slice(close + 1);
  }
  return segments.filter((segment) => segment.text.length > 0);
}

export const MAX_BOOK_SUGGESTIONS = 4;
export const MAX_TOPIC_SUGGESTIONS = 4;
/** Full-text search needs at least this many characters. */
export const MIN_SEARCH_LENGTH = 2;

export interface SearchSuggestions {
  reference: VerseRange | null;
  books: BibleBook[];
  topics: DiscoverTopic[];
}

function topicMatches(topic: DiscoverTopic, query: string): boolean {
  const needle = query.trim().toLowerCase();
  const title = topic.title.toLowerCase();
  return title.includes(needle) || needle.includes(title);
}

/** Instant suggestions shown above full-text results: a parsed reference, books and Discover topics. */
export function buildSearchSuggestions(query: string, topics: readonly DiscoverTopic[]): SearchSuggestions {
  const trimmed = query.trim();
  if (!trimmed) return { reference: null, books: [], topics: [] };
  return {
    reference: parseReference(trimmed),
    books: BOOKS.filter((book) => bookMatches(book, trimmed)).slice(0, MAX_BOOK_SUGGESTIONS),
    topics: topics.filter((topic) => topicMatches(topic, trimmed)).slice(0, MAX_TOPIC_SUGGESTIONS),
  };
}
