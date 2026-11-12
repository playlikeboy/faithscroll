/**
 * Read-only access to the study data bundled in assets/bible/bible.db (schema v2):
 * the topical index (OpenBible.info topics, CC BY 4.0, merged with Nave's Topical Bible, public domain)
 * and Easton's Bible Dictionary (1897, public domain). See docs/legal/bible-sources.md.
 */
import { getBibleExecutor } from '../db/connection';
import type { SqlParam } from '../db/executor';
import { toFtsPrefixQuery } from '../db/fts-query';
import { normalizeName } from './normalize';
import type {
  DictionaryEntry,
  DictionaryEntrySummary,
  TopicDetail,
  TopicPassage,
  TopicSection,
  TopicSource,
  TopicSummary,
} from './types';

/** CC BY 4.0 attribution for the OpenBible.info topical data — show it with topic results. */
export const TOPICS_ATTRIBUTION =
  'Topics from OpenBible.info (CC BY 4.0) and Nave’s Topical Bible (public domain).';
export const DICTIONARY_ATTRIBUTION = 'Easton’s Bible Dictionary (1897), public domain.';

const SOURCE_OPENBIBLE = 1;
const PREVIEW_LENGTH = 160;
const MAX_NAMES = 40;
const MAX_LIMIT = 100;
const PASSAGE_TEXT_VERSES = 3;
const POPULAR_LIMIT = 60;

interface TopicRow {
  id: number;
  name: string;
  verse_count: number;
}

interface PassageRow {
  start_verse_id: number;
  end_verse_id: number;
  weight: number;
  source: number;
  subtopic: number;
  text: string | null;
}

const toTopic = (row: TopicRow): TopicSummary => ({ id: row.id, name: row.name, verseCount: row.verse_count });

const clampLimit = (limit: number | undefined, fallback: number): number =>
  limit === undefined || !Number.isFinite(limit) ? fallback : Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)));

const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ');

/** SQL expression: text of the first verses of a passage (`tv` = topic_verses alias). */
const PASSAGE_TEXT_SQL = `(SELECT group_concat(text, ' ') FROM (
    SELECT text FROM verses WHERE id BETWEEN tv.start_verse_id AND tv.end_verse_id ORDER BY id LIMIT ${PASSAGE_TEXT_VERSES}
  ))`;

function toPassage(row: PassageRow): TopicPassage {
  // Verse ids are dense within a chapter, so a gap of 3+ means more verses than the text holds.
  const truncated = row.end_verse_id - row.start_verse_id >= PASSAGE_TEXT_VERSES;
  const text = row.text ?? '';
  return {
    startVerseId: row.start_verse_id,
    endVerseId: row.end_verse_id,
    text: truncated && text ? `${text} …` : text,
    weight: row.weight,
    source: (row.source === SOURCE_OPENBIBLE ? 'openbible' : 'nave') satisfies TopicSource,
  };
}

/** Topics whose normalized name is one of `names` (e.g. ["anxiety", "worry"]), in the given order. */
export async function findTopicsByName(names: readonly string[]): Promise<TopicSummary[]> {
  const normalized = [...new Set(names.map(normalizeName).filter(Boolean))].slice(0, MAX_NAMES);
  if (normalized.length === 0) return [];
  const rows = await getBibleExecutor().getAll<TopicRow & { normalized: string }>(
    `SELECT id, name, verse_count, normalized FROM topics WHERE normalized IN (${placeholders(normalized.length)})`,
    normalized,
  );
  const byName = new Map(rows.map((row) => [row.normalized, row]));
  return normalized.flatMap((name) => {
    const row = byName.get(name);
    return row ? [toTopic(row)] : [];
  });
}

/** Topics whose name contains the words (last word as a prefix); exact names first, then larger topics. */
export async function searchTopics(query: string, options: { limit?: number } = {}): Promise<TopicSummary[]> {
  const match = toFtsPrefixQuery(query);
  if (!match) return [];
  const limit = clampLimit(options.limit, 10);
  const rows = await getBibleExecutor().getAll<TopicRow>(
    `SELECT t.id, t.name, t.verse_count
       FROM topics_fts
       JOIN topics t ON t.id = topics_fts.rowid
      WHERE topics_fts MATCH ?
      ORDER BY (t.normalized = ?) DESC, length(t.normalized), t.verse_count DESC
      LIMIT ?`,
    [match, normalizeName(query), limit],
  );
  return rows.map(toTopic);
}

/**
 * Best passages across several topics (OpenBible.info votes first, then Nave's references),
 * de-duplicated by passage. Used by concept search.
 */
export async function getTopicPassages(
  topicIds: readonly number[],
  options: { limit?: number } = {},
): Promise<(TopicPassage & { topicId: number })[]> {
  const ids = [...new Set(topicIds)].filter((id) => Number.isInteger(id) && id > 0).slice(0, MAX_NAMES);
  if (ids.length === 0) return [];
  const limit = clampLimit(options.limit, 30);
  const params: SqlParam[] = [...ids, limit * 2];
  const rows = await getBibleExecutor().getAll<PassageRow & { topic_id: number }>(
    `SELECT tv.topic_id, tv.start_verse_id, tv.end_verse_id, tv.weight, tv.source, tv.subtopic, ${PASSAGE_TEXT_SQL} AS text
       FROM topic_verses tv
      WHERE tv.topic_id IN (${placeholders(ids.length)})
      ORDER BY tv.weight DESC, tv.source, tv.start_verse_id
      LIMIT ?`,
    params,
  );
  const seen = new Set<string>();
  const result: (TopicPassage & { topicId: number })[] = [];
  for (const row of rows) {
    const key = `${row.start_verse_id}-${row.end_verse_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...toPassage(row), topicId: row.topic_id });
    if (result.length === limit) break;
  }
  return result;
}

function groupSections(rows: readonly PassageRow[], labels: ReadonlyMap<number, string>): TopicSection[] {
  const sections = new Map<number, TopicPassage[]>();
  for (const row of rows) {
    const list = sections.get(row.subtopic);
    if (list) list.push(toPassage(row)); // local accumulator, never shared
    else sections.set(row.subtopic, [toPassage(row)]);
  }
  return [...sections.entries()]
    .sort(([a], [b]) => a - b)
    .map(([subtopic, passages]) => ({ label: labels.get(subtopic) ?? null, passages }));
}

/** A topic with its passages and "see also" topics, or null when the id is unknown. */
export async function getTopic(topicId: number): Promise<TopicDetail | null> {
  if (!Number.isInteger(topicId) || topicId <= 0) return null;
  const executor = getBibleExecutor();
  const topic = await executor.getFirst<TopicRow>('SELECT id, name, verse_count FROM topics WHERE id = ?', [topicId]);
  if (!topic) return null;
  const [popular, nave, labels, seeAlso] = await Promise.all([
    executor.getAll<PassageRow>(
      `SELECT tv.start_verse_id, tv.end_verse_id, tv.weight, tv.source, tv.subtopic, ${PASSAGE_TEXT_SQL} AS text
         FROM topic_verses tv WHERE tv.topic_id = ? AND tv.source = 1
        ORDER BY tv.weight DESC, tv.start_verse_id LIMIT ?`,
      [topicId, POPULAR_LIMIT],
    ),
    executor.getAll<PassageRow>(
      `SELECT tv.start_verse_id, tv.end_verse_id, tv.weight, tv.source, tv.subtopic, ${PASSAGE_TEXT_SQL} AS text
         FROM topic_verses tv WHERE tv.topic_id = ? AND tv.source = 2
        ORDER BY tv.subtopic, tv.start_verse_id`,
      [topicId],
    ),
    executor.getAll<{ subtopic: number; label: string }>(
      'SELECT subtopic, label FROM topic_subtopics WHERE topic_id = ? ORDER BY subtopic',
      [topicId],
    ),
    executor.getAll<TopicRow>(
      `SELECT t.id, t.name, t.verse_count FROM topic_links l JOIN topics t ON t.id = l.target_topic_id
        WHERE l.topic_id = ? ORDER BY t.name`,
      [topicId],
    ),
  ]);
  return {
    ...toTopic(topic),
    popular: popular.map(toPassage),
    sections: groupSections(nave, new Map(labels.map((row) => [row.subtopic, row.label]))),
    seeAlso: seeAlso.map(toTopic),
  };
}

interface DictionaryRow {
  id: number;
  term: string;
  preview: string;
}

const toSummary = (row: DictionaryRow): DictionaryEntrySummary => ({
  id: row.id,
  term: row.term,
  preview: row.preview.length >= PREVIEW_LENGTH ? `${row.preview.replace(/\s+\S*$/, '')}…` : row.preview,
});

/**
 * Dictionary entries for a query: exact term first, then entries whose term matches, then entries
 * whose definition mentions the words (term matches weigh ten times more).
 */
export async function searchDictionary(query: string, options: { limit?: number } = {}): Promise<DictionaryEntrySummary[]> {
  const match = toFtsPrefixQuery(query);
  if (!match) return [];
  const limit = clampLimit(options.limit, 10);
  const rows = await getBibleExecutor().getAll<DictionaryRow>(
    `SELECT d.id, d.term, substr(replace(d.definition, char(10), ' '), 1, ${PREVIEW_LENGTH}) AS preview
       FROM dictionary_fts
       JOIN dictionary d ON d.id = dictionary_fts.rowid
      WHERE dictionary_fts MATCH ?
      ORDER BY (d.normalized = ?) DESC, bm25(dictionary_fts, 10.0, 1.0)
      LIMIT ?`,
    [match, normalizeName(query), limit],
  );
  return rows.map(toSummary);
}

/** Entries whose term is exactly one of `names` (normalized), in the given order. */
export async function findDictionaryEntriesByName(names: readonly string[]): Promise<DictionaryEntrySummary[]> {
  const normalized = [...new Set(names.map(normalizeName).filter(Boolean))].slice(0, MAX_NAMES);
  if (normalized.length === 0) return [];
  const rows = await getBibleExecutor().getAll<DictionaryRow & { normalized: string }>(
    `SELECT id, term, normalized, substr(replace(definition, char(10), ' '), 1, ${PREVIEW_LENGTH}) AS preview
       FROM dictionary WHERE normalized IN (${placeholders(normalized.length)}) ORDER BY id`,
    normalized,
  );
  return normalized.flatMap((name) => rows.filter((row) => row.normalized === name).map(toSummary));
}

export async function getDictionaryEntry(id: number): Promise<DictionaryEntry | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  return getBibleExecutor().getFirst<DictionaryEntry>('SELECT id, term, definition FROM dictionary WHERE id = ?', [id]);
}
