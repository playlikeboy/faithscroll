import type { Href } from 'expo-router';

/**
 * Href builders for Bible-related routes (ours and other agents').
 * Cast to `Href` so typed routes keep compiling while sibling routes are still being built.
 */
function withQuery(path: string, query: Record<string, string | number | undefined>): Href {
  const pairs = Object.entries(query)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return (pairs.length ? `${path}?${pairs.join('&')}` : path) as Href;
}

export const bibleRoutes = {
  reader: (bookId: number, chapter: number, verse?: number): Href =>
    withQuery(`/bible/read/${bookId}/${chapter}`, { verse }),
  books: (options: { replaceReader?: boolean } = {}): Href =>
    withQuery('/bible/books', { replace: options.replaceReader ? 1 : undefined }),
  search: (): Href => '/bible/search' as Href,
  verseActions: (start: number, end: number = start): Href => withQuery('/bible/verse-actions', { start, end }),
  study: (start: number, end: number = start): Href => withQuery(`/bible/study/${start}`, { end }),
  note: (id: string): Href => `/bible/note/${encodeURIComponent(id)}` as Href,
  collectionsPicker: (start: number, end: number = start): Href =>
    withQuery('/bible/collections-picker', { start, end }),
  passagePicker: (params: { requestId: string; title?: string; start?: number; end?: number }): Href =>
    withQuery('/bible/passage-picker', params),
  // Routes owned by other agents.
  reflection: (start: number, end: number = start): Href =>
    withQuery('/journal/new', { type: 'bible_study', start, end }),
  askAboutPassage: (start: number, end: number = start): Href => withQuery('/study/ask', { start, end }),
  deepStudy: (start: number, end: number = start): Href => withQuery('/study/deep', { start, end }),
  discover: (): Href => '/discover' as Href,
  discoverTopic: (topicId: string): Href => `/discover/${encodeURIComponent(topicId)}` as Href,
} as const;
