/**
 * Links from Today / Discover into routes owned by other areas (see docs/AGENT_GUIDE.md route map).
 * Kept in one place so a route change is a one-line fix. Cast to `Href` so this compiles with
 * and without generated typed routes.
 */
import type { Href } from 'expo-router';

/** John 1 — the suggested first chapter when there's no reading history yet. */
export const FIRST_CHAPTER = { bookId: 43, chapter: 1 } as const;

export const todayRoutes = {
  bible: '/bible' as Href,
  discover: '/discover' as Href,
  settings: '/settings' as Href,
  newSermon: '/sermons/new' as Href,
  newJournalEntry: '/journal/new' as Href,
  newPrayer: '/prayers/new' as Href,
  actions: '/library/actions' as Href,
  readChapter: (bookId: number, chapter: number, verse?: number): Href =>
    (verse ? `/bible/read/${bookId}/${chapter}?verse=${verse}` : `/bible/read/${bookId}/${chapter}`) as Href,
  study: (startVerseId: number, endVerseId: number): Href =>
    `/bible/study/${startVerseId}?end=${endVerseId}` as Href,
  discoverTopic: (topicId: string): Href => `/discover/${encodeURIComponent(topicId)}` as Href,
  sermon: (id: string): Href => `/sermons/${id}` as Href,
  journalEntry: (id: string): Href => `/journal/${id}` as Href,
  prayer: (id: string): Href => `/prayers/${id}` as Href,
};
