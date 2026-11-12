/**
 * Offline concept search over the bundled Bible ("related topics", not AI).
 *
 * Ranking, strongest first:
 *   1. the exact phrase, 2. every word of the query,
 *   3. related concept words (curated concept map) in verses that a matching topic also lists,
 *      or that touch two or more of the query's concepts,
 *   4. passages from matching topics voted on at OpenBible.info,
 *   5. other related-concept matches, 6. Nave's references for matching topics.
 * Concept-only matches sit below voted topic passages because a single shared word ("forsaken")
 * is weaker evidence than a passage people tagged with the topic. Within a tier, FTS rank (bm25)
 * orders verses, with a bonus for topic votes and for each extra concept matched.
 */
import { getBibleExecutor } from '@/features/bible/db/connection';
import { toFtsAnyQuery, toFtsPhraseQuery, toFtsQuery } from '@/features/bible/db/fts-query';
import { parseReference } from '@/features/bible/reference';
import { searchWindow } from '@/features/bible/repository';
import { findTopicsByName, getTopicPassages, searchTopics } from '@/features/bible/study-data/repository';
import type { TopicPassage, TopicSummary } from '@/features/bible/study-data/types';
import { describeVerseRange } from '@/features/links/reference-text';

import { expandQuery, type Concept, type ExpandedQuery } from './expand';
import { stem } from './stem';
import type { MatchedVia, MatchKind, SemanticSearchOptions, SemanticSearchResponse, SemanticVerseResult } from './types';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const TIER = { phrase: 6, allWords: 5, strongConcept: 4, votedTopic: 3, concept: 2, naveTopic: 1 } as const;
const TIER_SPAN = 1_000;
const EXTRA_CONCEPT_BONUS = 200;
const MAX_WEIGHT = 50;
const WEIGHT_FACTOR = 4;
const MEMBERSHIP_BONUS = 50;
const FTS_LIMITS = { phrase: 20, all: 40, concept: 60 } as const;
const MAX_TOPICS = 8;
const TOPICS_FOR_PASSAGES = 4;
const TOPIC_PASSAGES = 40;

interface FtsRow {
  id: number;
  text: string;
  snippet: string;
}

type TopicHit = TopicPassage & { topicId: number };

const EMPTY_RESULTS: Omit<SemanticSearchResponse, 'expansion'> = { topics: [], results: [] };

async function ftsVerses(match: string | null, window: [number, number], limit: number): Promise<FtsRow[]> {
  if (!match) return [];
  return getBibleExecutor().getAll<FtsRow>(
    `SELECT v.id, v.text, highlight(verses_fts, 0, '«', '»') AS snippet
       FROM verses_fts
       JOIN verses v ON v.id = verses_fts.rowid
      WHERE verses_fts MATCH ? AND verses_fts.rowid BETWEEN ? AND ?
      ORDER BY rank
      LIMIT ?`,
    [match, window[0], window[1], limit],
  );
}

/** Exact topic names first (query, its words, concept words), then name matches; de-duplicated. */
async function findTopics(expansion: ExpandedQuery): Promise<TopicSummary[]> {
  const [named, searched] = await Promise.all([
    findTopicsByName(expansion.topicNames),
    expansion.keywords.length > 0 ? searchTopics(expansion.keywords.join(' '), { limit: MAX_TOPICS }) : Promise.resolve([]),
  ]);
  const unique = new Map<number, TopicSummary>();
  for (const topic of [...named, ...searched]) if (!unique.has(topic.id)) unique.set(topic.id, topic);
  return [...unique.values()].slice(0, MAX_TOPICS);
}

function firstMarked(snippet: string): string | null {
  return /«([^»]+)»/.exec(snippet)?.[1]?.toLowerCase() ?? null;
}

function explain(kind: MatchKind, row: FtsRow | null): MatchedVia {
  switch (kind) {
    case 'phrase':
      return { kind, label: 'Exact phrase' };
    case 'all-words':
      return { kind, label: 'Matches your words' };
    case 'concept': {
      const word = row ? firstMarked(row.snippet) : null;
      return { kind, label: word ? `Related word: ${word}` : 'Related topic' };
    }
    case 'some-words':
      return { kind, label: 'Matches some of your words' };
    case 'topic':
      return { kind, label: 'Topic' };
  }
}

function topicFor(verseId: number, hits: readonly TopicHit[]): TopicHit | undefined {
  return hits.find((hit) => verseId >= hit.startVerseId && verseId <= hit.endVerseId);
}

const topicBonus = (hit: TopicHit | undefined): number =>
  hit ? MEMBERSHIP_BONUS + Math.min(hit.weight, MAX_WEIGHT) * WEIGHT_FACTOR : 0;

/** How many of the query's concepts the highlighted words of a verse belong to. */
function conceptsIn(snippet: string, concepts: readonly Concept[]): number {
  const marked = new Set([...snippet.matchAll(/«([^»]+)»/g)].map((match) => stem(match[1])));
  return concepts.filter((concept) =>
    [concept.label, ...concept.terms].some((term) => !term.includes(' ') && marked.has(stem(term))),
  ).length;
}

function tierFor(kind: MatchKind, hit: TopicHit | undefined, conceptCount: number): number {
  if (kind === 'phrase') return TIER.phrase;
  if (kind === 'all-words') return TIER.allWords;
  return hit || conceptCount > 1 ? TIER.strongConcept : TIER.concept;
}

interface MergeInput {
  tiers: readonly { kind: MatchKind; rows: readonly FtsRow[] }[];
  topicHits: readonly TopicHit[];
  topicNames: ReadonlyMap<number, string>;
  concepts: readonly Concept[];
}

/** Merges tiers into one ranked list; a verse keeps its strongest tier. */
function merge({ tiers, topicHits, topicNames, concepts }: MergeInput): SemanticVerseResult[] {
  const byVerse = new Map<number, SemanticVerseResult>();
  for (const { kind, rows } of tiers) {
    rows.forEach((row, index) => {
      if (byVerse.has(row.id)) return;
      const hit = topicFor(row.id, topicHits);
      const conceptCount = kind === 'concept' ? conceptsIn(row.snippet, concepts) : 0;
      const bonus = topicBonus(hit) + Math.max(0, conceptCount - 1) * EXTRA_CONCEPT_BONUS;
      byVerse.set(row.id, {
        startVerseId: row.id,
        endVerseId: row.id,
        reference: describeVerseRange(row.id),
        text: row.text,
        snippet: row.snippet,
        matchedVia: explain(kind, row),
        topic: hit ? (topicNames.get(hit.topicId) ?? null) : null,
        score: tierFor(kind, hit, conceptCount) * TIER_SPAN + bonus + (rows.length - index),
      });
    });
  }
  const results = [...byVerse.values()];
  const overlaps = (a: { startVerseId: number; endVerseId: number }, b: TopicHit) =>
    a.startVerseId <= b.endVerseId && b.startVerseId <= a.endVerseId;
  // Hits arrive best first, so a passage is skipped when a verse or a better passage already covers it.
  const passages = topicHits.reduce<TopicHit[]>(
    (kept, hit) =>
      results.some((result) => overlaps(result, hit)) || kept.some((other) => overlaps(other, hit)) ? kept : [...kept, hit],
    [],
  );
  const fromTopics = passages.map((hit, index): SemanticVerseResult => {
    const name = topicNames.get(hit.topicId) ?? null;
    return {
      startVerseId: hit.startVerseId,
      endVerseId: hit.endVerseId,
      reference: describeVerseRange(hit.startVerseId, hit.endVerseId),
      text: hit.text,
      snippet: null,
      matchedVia: { kind: 'topic', label: name ? `Topic: ${name}` : explain('topic', null).label },
      topic: name,
      score:
        (hit.source === 'openbible' ? TIER.votedTopic : TIER.naveTopic) * TIER_SPAN +
        topicBonus(hit) +
        (passages.length - index) / passages.length,
    };
  });
  return [...results, ...fromTopics].sort((a, b) => b.score - a.score || a.startVerseId - b.startVerseId);
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));
}

/**
 * Concept search over the bundled Bible. Bible references ("Romans 8:28") and queries shorter than
 * two characters return no verses (open the passage instead).
 */
export async function semanticSearchBible(rawQuery: string, options: SemanticSearchOptions = {}): Promise<SemanticSearchResponse> {
  const query = rawQuery.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
  const expansion = expandQuery(query);
  if (query.replace(/["“”„]/g, '').length < MIN_QUERY_LENGTH || parseReference(query)) return { expansion, ...EMPTY_RESULTS };

  const window = searchWindow(options);
  const hasConcepts = expansion.concepts.length > 0;
  const conceptMatch = hasConcepts
    ? toFtsAnyQuery([...expansion.words.filter((word) => expansion.keywords.includes(word)), ...expansion.coreTerms, ...expansion.relatedTerms])
    : expansion.keywords.length > 1
      ? toFtsAnyQuery(expansion.keywords)
      : null;

  const [phrase, all, concept, topics] = await Promise.all([
    ftsVerses(toFtsPhraseQuery(query), window, FTS_LIMITS.phrase),
    ftsVerses(toFtsQuery(query), window, FTS_LIMITS.all),
    ftsVerses(conceptMatch, window, FTS_LIMITS.concept),
    findTopics(expansion),
  ]);
  const topicHits = (
    await getTopicPassages(
      topics.slice(0, TOPICS_FOR_PASSAGES).map((topic) => topic.id),
      { limit: TOPIC_PASSAGES },
    )
  ).filter((hit) => hit.startVerseId >= window[0] && hit.endVerseId <= window[1]);

  const results = merge({
    tiers: [
      { kind: 'phrase', rows: phrase },
      { kind: 'all-words', rows: all },
      { kind: hasConcepts ? 'concept' : 'some-words', rows: concept },
    ],
    topicHits,
    topicNames: new Map(topics.map((topic) => [topic.id, topic.name])),
    concepts: expansion.concepts,
  });
  return { expansion, topics, results: results.slice(0, clampLimit(options.limit)) };
}
