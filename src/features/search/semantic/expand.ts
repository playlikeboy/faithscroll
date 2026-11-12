/**
 * Offline query expansion: maps the words of a query onto the curated concept map
 * ("worried" → Anxiety → anxious, worry, troubled… plus related Peace, Trust, Rest).
 * Pure functions, no I/O.
 */
import { CONCEPTS, type ConceptSource } from './concepts';
import { stem } from './stem';

export interface Concept {
  key: string;
  label: string;
  terms: readonly string[];
  related: readonly string[];
}

export interface ExpandedQuery {
  /** Collapsed, trimmed query. */
  query: string;
  /** Lower-case words of the query. */
  words: string[];
  /** Words that carry meaning (stop words removed). */
  keywords: string[];
  /** Matched concepts, strongest first (at most MAX_CONCEPTS). */
  concepts: Concept[];
  /** Synonyms from the matched concepts (not already in the query). */
  coreTerms: string[];
  /** Main words of related concepts. */
  relatedTerms: string[];
  /** Short list for "Also searching: …" chips. */
  alsoSearching: string[];
  /** Candidate topic names to look up in the topical index. */
  topicNames: string[];
}

const MAX_CONCEPTS = 3;
const MAX_NGRAM = 3;
const MAX_CHIPS = 5;
const CORE_CHIPS_PER_CONCEPT = 2;
const RELATED_PER_CONCEPT = 3;
const MAX_SYNONYMS = 6;

/** Words that never select a concept on their own (they still count inside phrases). */
const STOP_WORDS = new Set([
  'a', 'about', 'after', 'all', 'am', 'an', 'and', 'are', 'as', 'at', 'be', 'bible', 'but', 'by', 'can', 'do', 'does',
  'feel', 'feeling', 'feelings', 'for', 'from', 'get', 'god', 'gods', 'have', 'help', 'how', 'i', 'im', 'in', 'is', 'it',
  'lord', 'me', 'my', 'of', 'on', 'or', 'over', 'say', 'says', 'scriptures', 'so', 'some', 'that', 'the', 'their', 'them',
  'this', 'to', 'verse', 'verses', 'want', 'was', 'we', 'what', 'when', 'who', 'why', 'with', 'you', 'your',
]);

export const conceptKey = (label: string): string => label.toLowerCase();

const stemPhrase = (phrase: string): string => tokenize(phrase).map(stem).join(' ');

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '’')
    .split(/[^\p{L}\p{N}’]+/u)
    .map((word) => word.replace(/^’+|’+$/g, ''))
    .filter(Boolean);
}

function toConcept(source: ConceptSource): Concept {
  return { key: conceptKey(source.label), label: source.label, terms: source.terms, related: source.related };
}

/** stemmed phrase → concepts that use it (label or term). Built once. */
const INDEX: ReadonlyMap<string, readonly Concept[]> = (() => {
  const index = new Map<string, Concept[]>();
  for (const source of CONCEPTS) {
    const concept = toConcept(source);
    for (const phrase of new Set([source.label, ...source.terms].map(stemPhrase))) {
      if (!phrase) continue;
      index.set(phrase, [...(index.get(phrase) ?? []), concept]);
    }
  }
  return index;
})();

const BY_KEY: ReadonlyMap<string, Concept> = new Map(CONCEPTS.map((source) => [conceptKey(source.label), toConcept(source)]));

export function getConcept(key: string): Concept | undefined {
  return BY_KEY.get(key);
}

/** Concepts named by the words, longest phrases first ("love of god" before "love"). */
function matchConcepts(words: readonly string[]): Concept[] {
  const stems = words.map(stem);
  const found: Concept[] = [];
  const add = (concepts: readonly Concept[] | undefined) => {
    for (const concept of concepts ?? []) if (!found.some((existing) => existing.key === concept.key)) found.push(concept);
  };
  for (let size = Math.min(MAX_NGRAM, words.length); size >= 1; size -= 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      if (size === 1 && STOP_WORDS.has(words[start])) continue;
      add(INDEX.get(stems.slice(start, start + size).join(' ')));
    }
  }
  return found.slice(0, MAX_CONCEPTS);
}

function uniqueByStem(candidates: readonly string[], exclude: ReadonlySet<string>): string[] {
  const seen = new Set(exclude);
  const result: string[] = [];
  for (const candidate of candidates) {
    const key = stemPhrase(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

export function expandQuery(rawQuery: string): ExpandedQuery {
  const query = rawQuery.replace(/\s+/g, ' ').trim();
  const words = tokenize(query.replace(/["“”„]/g, ' '));
  const keywords = words.filter((word) => !STOP_WORDS.has(word) && word.length > 1);
  const concepts = matchConcepts(words);
  const queryStems = new Set([...words.map(stem), stemPhrase(query)]);

  const coreTerms = uniqueByStem(
    concepts.flatMap((concept) => [concept.label.toLowerCase(), ...concept.terms]),
    queryStems,
  );
  const relatedConcepts = concepts
    .flatMap((concept) => concept.related.slice(0, RELATED_PER_CONCEPT))
    .filter((key) => !concepts.some((concept) => concept.key === key))
    .map((key) => BY_KEY.get(key))
    .filter((concept): concept is Concept => concept !== undefined);
  const relatedTerms = uniqueByStem(
    relatedConcepts.map((concept) => concept.terms[0] ?? concept.key),
    new Set([...queryStems, ...coreTerms.map(stemPhrase)]),
  );

  const coreChips = concepts.flatMap((concept) =>
    uniqueByStem([concept.label.toLowerCase(), ...concept.terms], queryStems).slice(0, CORE_CHIPS_PER_CONCEPT),
  );
  const alsoSearching = uniqueByStem([...coreChips, ...relatedTerms], queryStems).slice(0, MAX_CHIPS);
  const topicNames = [
    ...new Set([query, ...keywords, ...concepts.flatMap((concept) => [concept.label, ...concept.terms])].map((name) => name.toLowerCase())),
  ];

  return { query, words, keywords, concepts, coreTerms, relatedTerms, alsoSearching, topicNames };
}

/**
 * The term plus close synonyms from the concept map, for matching personal notes
 * ("anxiety" also finds a journal entry about "worry"). The term itself always comes first.
 */
export function synonymsFor(term: string): string[] {
  const normalized = term.toLowerCase().trim();
  if (!normalized) return [];
  const concepts = matchConcepts(tokenize(normalized)).filter((concept) =>
    [concept.label, ...concept.terms].some((candidate) => stemPhrase(candidate) === stemPhrase(normalized)),
  );
  const synonyms = uniqueByStem(
    concepts.flatMap((concept) => [concept.label.toLowerCase(), ...concept.terms]).filter((word) => word.length > 2),
    new Set([stemPhrase(normalized)]),
  );
  return [normalized, ...synonyms.slice(0, MAX_SYNONYMS - 1)];
}
