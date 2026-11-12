import type { Href } from 'expo-router';

/** Screens for the bundled study data (cast: typed routes may not be regenerated yet). */
export const studyRoutes = {
  topic: (id: number): Href => `/bible/topic/${id}` as Href,
  dictionary: (id: number): Href => `/bible/dictionary/${id}` as Href,
  bibleSearch: (query: string): Href => `/bible/search?q=${encodeURIComponent(query)}` as Href,
};
