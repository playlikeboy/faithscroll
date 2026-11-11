/**
 * CONTRACT STUB — owned by the bible-data agent.
 * Curated, human-written content: Verse of the Day rotation and Discover topics.
 */
import type { DiscoverTopic, VerseRange } from './types';

/** Deterministic Verse of the Day for a local calendar date (works offline). */
export function getVerseOfTheDay(_date: Date): VerseRange {
  return { start: { bookId: 19, chapter: 23, verse: 1 }, end: { bookId: 19, chapter: 23, verse: 1 } };
}

export const DISCOVER_TOPICS: readonly DiscoverTopic[] = [];

export function getDiscoverTopic(id: string): DiscoverTopic | undefined {
  return DISCOVER_TOPICS.find((topic) => topic.id === id);
}
