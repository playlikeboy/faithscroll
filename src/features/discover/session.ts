import { DISCOVER_TOPICS, getDiscoverTopic } from '@/features/bible/curated';
import { getVerses } from '@/features/bible/repository';
import type { DiscoverCard, DiscoverTopic, VerseRange } from '@/features/bible/types';
import { rangeToIds } from '@/features/bible/verse-id';
import { logger } from '@/lib/logger';
import { joinVerseText, passageLabel } from '@/features/today/passage';

/** A session is deliberately short: it ends, and points back into whole-chapter reading. */
export const MAX_SESSION_CARDS = 10;

export interface SessionCard {
  id: string;
  range: VerseRange;
  startVerseId: number;
  endVerseId: number;
  reference: string;
  context: string;
  /** Null when the passage couldn't be loaded on this device. */
  text: string | null;
}

export interface TopicSummary {
  id: string;
  title: string;
  description: string;
  cardCount: number;
}

export function listTopics(topics: readonly DiscoverTopic[] = DISCOVER_TOPICS): TopicSummary[] {
  return topics
    .filter((topic) => topic.cards.length > 0)
    .map(({ id, title, description, cards }) => ({
      id,
      title,
      description,
      cardCount: Math.min(cards.length, MAX_SESSION_CARDS),
    }));
}

export function findTopic(topicId: string | undefined): DiscoverTopic | null {
  if (!topicId) return null;
  return getDiscoverTopic(topicId) ?? null;
}

export function sessionCards(topic: DiscoverTopic): readonly DiscoverCard[] {
  return topic.cards.slice(0, MAX_SESSION_CARDS);
}

/** Loads verse text for every card in parallel; one failed passage doesn't sink the session. */
export async function loadSession(topic: DiscoverTopic): Promise<SessionCard[]> {
  const cards = sessionCards(topic);
  const results = await Promise.allSettled(cards.map((card) => getVerses(card.range)));
  return cards.map((card, index) => {
    const result = results[index];
    if (result.status === 'rejected') {
      logger.warn('Discover passage failed to load', { topicId: topic.id, cardId: card.id });
    }
    const text = result.status === 'fulfilled' ? joinVerseText(result.value) : '';
    return {
      id: card.id,
      range: card.range,
      ...rangeToIds(card.range),
      reference: passageLabel(card.range),
      context: card.context,
      text: text || null,
    };
  });
}
